import { Broker, Consumer, Message } from "..";
import config from "./config";

(async () => {
  class OrderSaveConsumer extends Consumer {
    public readonly name = "order.save"; // set subscribe name or use new OrderSaveConsumer("order.save")

    async onMessage(content: any, message: Message) {
      const forwardedCount =
        message.properties.headers.rascal?.recovery?.order?.save?.service_b
          ?.forwarded;

      if (forwardedCount > 0) {
        console.log(
          "Already forwarded number of times: ",
          forwardedCount,
          // JSON.stringify(message, null, 1),
          content
        );
      }

      // your code
      if ((content as string)?.indexOf("1") >= 0 && Math.random() > 0.5) {
        throw new Error("some message error");
      }

      if (forwardedCount > 0) {
        console.log(
          `content: ${content} solved after ${forwardedCount} attempts.`
        );
      } else {
        console.log("content:" + content);
      }
      // no need to call ackOrNack if your code success, Consumer will do this for you
    }
  }

  const broker = await Broker.create(config);
  await broker.addConsumer(new OrderSaveConsumer());
})();
