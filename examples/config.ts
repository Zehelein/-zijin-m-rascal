const config = {
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
        // Create a delay queues to hold failed messages for a short interval before retrying
        "delay:10sec": {
          options: {
            arguments: {
              // Configure messages to expire after 1 minute, then route to the retry exchange
              "x-message-ttl": 10000,
              "x-dead-letter-exchange": "retry",
            },
          },
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
        retry: {
          assert: true,
        },
        delay: {
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
        delay: {
          source: "delay",
          bindingKey: "delay.10sec",
          destination: "delay:10sec",
          destinationType: "queue",
        },
        retry: {
          source: "retry",
          bindingKey: "order.save.service_b.*",
          destination: "order.save.service_b",
          destinationType: "queue",
        },
      },
      publications: {
        "order.save": {
          vhost: "/",
          exchange: "order",
          routingKey: "save",
        },
        // Forward messages to the 1 minute delay queue when retrying
        retry_in_10sec: {
          exchange: "delay",
          options: {
            CC: ["delay.10sec"],
          },
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
        strategy: "forward",
        attempts: 3,
        publication: "retry_in_10sec",
        xDeathFix: true, // See https://github.com/rabbitmq/rabbitmq-server/issues/161
      },
      {
        strategy: "nack",
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

export default config;
