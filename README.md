<p align="center">
  <img src="redis-logo.png" alt="Redis logo" width="200" />
</p>

<h1 align="center">Redis Cache Lab</h1>

<p align="center">
  Hands-on lab to practice <strong>Redis as a caching layer</strong> with Node.js/TypeScript.<br />
  Observe HIT/MISS, TTL, invalidation, metrics, and the performance impact of cache.
</p>

<p align="center">
  <a href="https://redis.io/">
    <img src="https://img.shields.io/badge/Redis-Official%20Docs-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis Official Documentation" />
  </a>
</p>

<p align="center">
 <img src="https://github.com/Viniciusdelmo/redis-cache/actions/workflows/ci.yml/badge.svg" alt="CI Status"/>
</p>


## Goal

Practice:

- Cache-Aside pattern
- `GET` / `SET` / `DEL`
- TTL (Time To Live)
- Cache invalidation
- Cache HIT / MISS
- Basic cache consistency
- Metrics (hits, misses, hit rate)
- Trade-offs of using a cache

## Stack

- Node.js + TypeScript
- Fastify
- Redis
- MongoDB
- Docker Compose

## Architecture

```text
Client
  ↓
Node.js / Fastify
  ↓
Redis  →  HIT → respond
  ↓ MISS
MongoDB → write to Redis (TTL) → respond
```

- **MongoDB** = source of truth
- **Redis** = temporary copy to speed up repeated reads


## Cache-Aside (read path)

Flow for `GET /products/:id`:

1. Build key `product:{id}`
2. Query Redis (`GET`)
3. **HIT** → return JSON from cache (no delay, no Mongo)
4. **MISS** → artificial delay + fetch from Mongo → `SET` in Redis with TTL → return product

## TTL and invalidation

- When filling the cache: `SET` with `{ EX: 60 }` (expires in 60s)
- On **update** (`PUT`) or **delete** (`DELETE`): `DEL product:{id}`
- The next GET will not return stale data; it becomes a MISS and reloads from Mongo

TTL also invalidates on its own: after the key expires, the next GET is a MISS again.

## Metrics

`GET /cache-stats` returns in-memory counters (reset when the API restarts):

```json
{
  "hits": 2,
  "misses": 1,
  "hitRate": "67%"
}
```

- **hit** — response came from Redis
- **miss** — Mongo had to be queried



## API


| Method | Route           | Description                                          |
| ------ | --------------- | ---------------------------------------------------- |
| GET    | `/health`       | Healthcheck                                          |
| GET    | `/products`     | List products (Mongo + delay)                        |
| GET    | `/products/:id` | Get by id (Cache-Aside)                              |
| POST   | `/products`     | Create product `{ "name": string, "price": number }` |
| PUT    | `/products/:id` | Update and invalidate cache                          |
| DELETE | `/products/:id` | Delete and invalidate cache                          |
| GET    | `/cache-stats`  | Hits / misses / hit rate                             |




## How to run

Prerequisites: Node.js, Docker Desktop.

```bash
docker compose up -d
npm install
npm run dev
```

API at `http://localhost:3000`.

Redis: `localhost:6379` · MongoDB: `localhost:27017` (database `redis_cache_lab`).

### Examples

```bash
# create
curl -s -X POST http://localhost:3000/products \
  -H 'content-type: application/json' \
  -d '{"name":"Shirt","price":59.99}'

# read (1st ≈ MISS / slow, 2nd ≈ HIT / fast)
ID=YOUR_ID
curl -s -w '\n%{time_total}\n' http://localhost:3000/products/$ID
curl -s -w '\n%{time_total}\n' http://localhost:3000/products/$ID

# update (invalidates cache)
curl -s -X PUT http://localhost:3000/products/$ID \
  -H 'content-type: application/json' \
  -d '{"name":"New Shirt","price":79.99}'

# metrics
curl -s http://localhost:3000/cache-stats
```

Artificial Mongo delay: **3s** (so the cache benefit is obvious).

## Benchmark (lab results)


| Scenario                        | Approx. time |
| ------------------------------- | ------------ |
| No cache / MISS (Mongo + delay) | ~3.01 s (Fake Delay)     |
| With Redis / HIT                | ~2–3 ms (0,002s - 0,003s)  |


Repeated reads of the same product avoid paying the database cost (and the simulated delay).

## Trade-offs

1. **Speed vs freshness** — cache may serve slightly stale data until TTL or `DEL`
2. **Memory** — each key uses Redis RAM; you need expiration / size policies
3. **Complexity** — wrong or missing invalidation causes hard-to-debug inconsistency
4. **Not everything should be cached** — real-time / critical data (e.g. balance, vital signs) needs extreme care or no cache layer



## Project structure

```text
src/
  server.ts           # Fastify boot + connections
  db.ts               # MongoDB
  redis.ts            # Redis
  cacheStats.ts       # hit/miss counters
  routes/products.ts  # CRUD + Cache-Aside
docker-compose.yml    # Redis + Mongo
```
