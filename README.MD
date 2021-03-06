# @zijin-m/Rascal

@zijin-m/Rascal wrapper for [rascal](https://www.npmjs.com/package/rascal) to support default publication, subscription handlers, auto republish message when confirm failed, auto ackOrNack when no error emit from your handler. only support es6+;

[![NPM version](https://img.shields.io/npm/v/@zijin-m/rascal.svg?style=flat-square)](https://www.npmjs.com/package/@zijin-m/rascal)
[![NPM downloads](https://img.shields.io/npm/dm/@zijin-m/rascal.svg?style=flat-square)](https://www.npmjs.com/package/@zijin-m/rascal)
[![Build Status](https://img.shields.io/travis/guidesmiths/@zijin-m/rascal/master.svg)](https://travis-ci.org/guidesmiths/@zijin-m/rascal)
[![Code Style](https://img.shields.io/badge/code%20style-imperative-brightgreen.svg)](https://github.com/guidesmiths/eslint-config-imperative)
[![Dependency Status](https://david-dm.org/guidesmiths/@zijin-m/rascal.svg)](https://david-dm.org/guidesmiths/@zijin-m/rascal)
[![devDependencies Status](https://david-dm.org/guidesmiths/@zijin-m/rascal/dev-status.svg)](https://david-dm.org/guidesmiths/@zijin-m/rascal?type=dev)

# About

Rascal is a rich pub/sub wrapper for the excellent amqplib. One of the best things about Rascal is that make amqplib easier.

This project want to add more default features for rascal that:

- default broker error handler
- default publication event handler for success, return and error
- republish message when confirm error from rabbitMQ
- default subscription event handler for message, error and so on
- auto ackOrNack message when no error throw form handler
- ts support

# Examples

### Config

With a Rascal config, [read more](https://github.com/guidesmiths/rascal#configuration)

```js
module.exports = {
  vhosts: {
    "/": {
      connection: {
        protocol: "amqp",
        hostname: "127.0.0.1",
        port: 5672,
        user: "guest",
        password: "guest",
      },
      queues: {
        "order.save.service_b": {
          assert: true,
          options: {
            arguments: {
              "x-dead-letter-exchange": "dead_letters",
              "x-dead-letter-routing-key": "order.save",
            },
          },
        },
        "dead_letters.order.save.service_b": {
          assert: true,
        },
      },
      exchanges: {
        order: {
          type: "direct",
          assert: true,
        },
        dead_letters: {
          type: "direct",
          assert: true,
        },
      },
      bindings: {
        "order.save.service_b": {
          source: "order",
          bindingKey: "save",
          destination: "order.save.service_b",
          destinationType: "queue",
        },
        "dead_letters.order.save.service_b": {
          source: "dead_letters",
          bindingKey: "order.save",
          destination: "dead_letters.order.save.service_b",
          destinationType: "queue",
        },
      },
      publications: {
        "order.save": {
          vhost: "/",
          exchange: "order",
          routingKey: "save",
        },
      },
      subscriptions: {
        "order.save": {
          queue: "order.save.service_b",
          prefetch: 1,
          vhost: "/",
          recovery: "deferred_retry",
          redeliveries: {
            limit: 10,
            counter: "shared",
          },
        },
      },
    },
  },
  recovery: {
    deferred_retry: [
      {
        strategy: "nack",
        requeue: true,
        defer: 10 * 1000,
      },
    ],
  },
  redeliveries: {
    counters: {
      shared: {
        type: "inMemory",
      },
    },
  },
};
```

### Publish

```js
import { Broker, Consumer } from "@zijin-m/rascal";
import config from "./config";

const broker = await Broker.create(config);
const publication = await broker.publish("order.save", "some message");
```

when you publish message, `Publication` will use a `failedQueue` that save all failed confirm message, to retry failed messages when connection recovery event emit or interval timer success publish message that is head of `failedQueue` .

Note

- `message` push to `failedQueue` only rabbitMQ return `error` confirm event, when return `return` confirm event, `Publication` will `nack` message, leading to message loss if you have not configured a dead letter exchange/queue.

you can also add your event handlers by listen `broker.publish` returned `eventemitter` :

```js
publication.on("error", console.error);
publication.on("return", console.log);
publication.on("success", console.log);
```

### Subscribe

```js
import { Broker, Consumer, Message } from "@zijin-m/rascal";
import config from "./config";

class OrderSaveConsumer extends Consumer {

    public readonly name = "order.save"; // set subscribe name or use new OrderSaveConsumer("order.save")

    async onMessage(content: any, message: Message) {
        // your code
        // no need to call ackOrNack if your code success, Consumer will do this for you
    }
}

const broker = await Broker.create(config)
await broker.addConsumer(new OrderSaveConsumer())

```

### auto ack

you can write your message handler code in `onMessage` method,
here are a few things that can happen:

#### onMessage call completed normally

Consumer will call `ackOrNack()` to ack message.

#### onMessage call throw error

Consumer will call `ackOrNack(error)` to not ack message, leading to message loss if you have not configured a dead letter exchange/queue.

### onMessage call throw error and you config redeliveries

if you do want to retry some times when your code throw error for network failed and other reason that can success handle this message after retry, you can config `redeliveries` in `config file` that named `config.json or config.ts` like examples,

```js
subscriptions: {
    "order.save": {
        queue: "order.save.service_b",
        prefetch: 1,
        vhost: "/",
        recovery: "deferred_retry", // use recovery
        redeliveries: {
            limit: 10, // max retry time
            counter: "shared"
        }
    },
},
// define recovery
recovery: {
  deferred_retry: [
      {
          strategy: "nack", // nack message
          requeue: true, // tell rabbitMQ to requeue requeue message
          defer: 10 * 1000 // defer 10 * 1000 ms to nack message for wait other service or network to restore 。
      }
  ]
},
redeliveries: {
  counters: {
      shared: {
          type: "inMemory", // save timer in memory
      }
  }
}
```

after config, `Consumer` will use recovery `deferred_retry` to retry 10 time, each time defer `10 * 1000` ms to wait network or other make message failed reason recover. and if all 10 time failed, `Consumer` will `ackOrNack(err)` by listen `redeliveries_exceeded` that emitted by `rascal` [redeliveries_exceeded](https://github.com/guidesmiths/rascal#avoiding-potential-message-loss), leading to message loss if you have not configured a dead letter exchange/queue.

#### Implementing your own counter

`inMemory` counter only save timer in memory, it will loss when restart you app,
and not so accurate in cluster mode 。If want to protect yourself from redeliveries, you need to implement your own counter backed by something like redis. read more [implementing-your-own-counter](https://github.com/guidesmiths/rascal#implementing-your-own-counter).

### custom ack message

if you want to custom message by call `ackOrNack` your self, you can do like :

```js
class OrderSaveConsumer extends Consumer {
  async onMessage(content: any, message: Message, ackOrNack: AckOrNackFn) {
    // your code
    // see https://github.com/guidesmiths/rascal#message-acknowledgement-and-recovery-strategies
    ackOrNack(err, { strategy: "republish", defer: 1000 });
  }
}
```

when you manual call ackOrNack , `Consumer` will not call it more.
