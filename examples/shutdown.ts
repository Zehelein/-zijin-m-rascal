import { Broker } from "../dist";

const shutdownAndExit = async (broker: Broker, exitCode: number, log: any) => {
  if (log) console.log(log);
  await broker.shutdown();
  process.exit(exitCode);
};

export const registerForShutdown = async (broker: Broker): Promise<void> => {
  process
    .on("SIGINT", async () => await shutdownAndExit(broker, 0, "SIGINT"))
    .on("SIGTERM", async () => await shutdownAndExit(broker, 0, "SIGTERM"))
    .on("unhandledRejection", async (reason) => {
      await shutdownAndExit(broker, -1, reason);
    })
    .on("uncaughtException", async (err) => {
      await shutdownAndExit(broker, -2, err);
    });
};
