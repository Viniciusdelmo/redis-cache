import { MongoClient, Db, Collection, Document } from "mongodb";

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

let products: Collection<Document>;

export async function connectDb() {
  await client.connect();
  const db: Db = client.db("redis_cache_lab");
  products = db.collection("products");
}

export function getProductsCollection() {
  return products;
}