import { Broker, Consumer, Message } from "../dist";
import config from "./config";
import { registerForShutdown } from "./shutdown";

(async () => {
  class OrderSaveConsumer extends Consumer {
    public readonly name = "order.save"; // set subscribe name or use new OrderSaveConsumer("order.save")

    async onMessage(content: any, message: Message) {
      // your code
      const count =
        message.properties.headers.rascal?.recovery?.order?.save?.service_b
          ?.forwarded || 0;

      // provoke random crashes to test redeliveries
      if ((content as string)?.indexOf("1") >= 0 && Math.random() > 0.5) {
        console.log(`crashing for '${content}' (had ${count} redeliveries)`);
        throw new Error("some processing error");
      }

      console.log(
        `'${content}' processed`,
        count > 0 ? `after ${count} redeliveries` : ""
      );
      // no need to call ackOrNack if your code success, Consumer will do this for you
    }
  }

  const broker = await Broker.create(config);
  registerForShutdown(broker);
  await broker.addConsumer(new OrderSaveConsumer());
})();
