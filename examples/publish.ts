import { Broker } from "..";
import config from "./config";
import { registerForShutdown } from "./shutdown";

(async () => {
  const broker = await Broker.create(config);
  registerForShutdown(broker);

  let counter = 0;
  setInterval(async () => {
    counter++;
    const publication = await broker.publish(
      "order.save",
      "some message number " + counter
    );
    console.log("Published message number " + counter);
  }, 1000);
})();
