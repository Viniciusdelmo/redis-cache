import { FastifyInstance } from "fastify";
import { ObjectId } from "mongodb";
import { getRedis } from "../redis";
import { getProductsCollection } from "../db";
import { getCacheStats, recordHit, recordMiss } from "../cacheStats";

const DB_DELAY_MS = 3000;

async function simulateDbDelay() {
    await new Promise((resolve) => setTimeout(resolve, DB_DELAY_MS));
}

type ProductBody = {
    name: string;
    price: number;
};

export async function productsRoutes(app: FastifyInstance) {
    const products = () => getProductsCollection();

    app.get("/products", async () => {
        await simulateDbDelay();
        return products().find().toArray();
    });

    app.get<{ Params: { id: string } }>("/products/:id", async (request, reply) => {
        const { id } = request.params;

        if (!ObjectId.isValid(id)) {
            return reply.status(400).send({ error: "Invalid product id" });
        }

        const redis = getRedis();
        const cacheKey = `product:${id}`;

        const cachedProduct = await redis.get(cacheKey);

        if (cachedProduct) {
            recordHit(); 
            return JSON.parse(cachedProduct);
        }

        recordMiss();
        await simulateDbDelay();

        const product = await products().findOne({ _id: new ObjectId(id) });

        if (!product) {
            return reply.status(404).send({ error: "Product not found" });
        }

        await redis.set(cacheKey, JSON.stringify(product), { EX: 60 });
        return product;
    });

    app.get("/cache-stats", async () => {
        return getCacheStats();
    });

    app.post<{ Body: ProductBody }>("/products", async (request, reply) => {
        const { name, price } = request.body ?? {};

        console.log("name", name);
        console.log("price", price);

        if (typeof name !== "string" || typeof price !== "number") {
            return reply.status(400).send({ error: "Body must include name (string) and price (number)" });
        }

        const result = await products().insertOne({ name, price });

        return reply.status(201).send({
            _id: result.insertedId,
            name,
            price,
        });
    });

    app.put<{ Params: { id: string }; Body: ProductBody }>("/products/:id", async (request, reply) => {
        const { id } = request.params;
        const { name, price } = request.body ?? {};

        if (!ObjectId.isValid(id)) {
            return reply.status(400).send({ error: "Invalid product id" });
        }

        const redis = getRedis();

        if (typeof name !== "string" || typeof price !== "number") {
            return reply.status(400).send({ error: "Body must include name (string) and price (number)" });
        }

        const result = await products().findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: { name, price } },
            { returnDocument: "after" }
        );

        if (!result) {
            return reply.status(404).send({ error: "Product not found" });
        }

        await redis.del(`product:${id}`);

        return result;
    });

    app.delete<{ Params: { id: string } }>("/products/:id", async (request, reply) => {
        const { id } = request.params;

        if (!ObjectId.isValid(id)) {
            return reply.status(400).send({ error: "Invalid product id" });
        }

        const redis = getRedis();

        const result = await products().deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return reply.status(404).send({ error: "Product not found" });
        }

        await redis.del(`product:${id}`);

        return reply.status(204).send();
    });
}
