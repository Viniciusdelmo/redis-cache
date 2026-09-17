import Fastify from "fastify";
import { connectDb } from "./db";
import { connectRedis } from "./redis";
import { productsRoutes } from "./routes/products";

const app = Fastify({
  logger: true,
});

app.get("/health", async () => {
  return {
    status: "ok",
  };
});

const start = async () => {
  try {
    await connectDb();
    await connectRedis();
    await app.register(productsRoutes);

    await app.listen({
      port: 3000,
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
