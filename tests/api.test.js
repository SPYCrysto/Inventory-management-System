import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";

import { connectDB } from "../server/db.js";
import app from "../server/app.js";
import Product from "../server/models/Product.js";
import Movement from "../server/models/Movement.js";

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await Product.deleteMany({});
  await Movement.deleteMany({});
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Movement.deleteMany({});
});

const sample = {
  name: "Mechanical Keyboard",
  sku: "KB-001",
  category: "Electronics",
  quantity: 5,
  lowStockThreshold: 10,
  price: 99.99,
};

describe.sequential("Inventra Supabase API Endpoints", () => {
  it("GET /api/health - returns system health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("database");
    expect(res.body.provider).toBe("Supabase Postgres");
  });

  it("POST /api/products - creates a product and logs initial movement", async () => {
    const res = await request(app).post("/api/products").send(sample);
    expect(res.status).toBe(201);
    expect(res.body.sku).toBe("KB-001");
    expect(res.body.quantity).toBe(5);

    const movements = await Movement.find({ sku: "KB-001" });
    expect(movements.length).toBe(1);
    expect(movements[0].delta).toBe(5);
  });

  it("POST /api/products - rejects duplicate SKU", async () => {
    await request(app).post("/api/products").send(sample);
    const res = await request(app).post("/api/products").send(sample);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("GET /api/products - returns filtered products", async () => {
    await request(app).post("/api/products").send(sample);
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it("PATCH /api/products/:id/stock - adjusts quantity and logs movement", async () => {
    const created = await Product.create(sample);
    const res = await request(app)
      .patch(`/api/products/${created._id}/stock`)
      .send({ delta: 15, reason: "Restock Shipment" });

    expect(res.status).toBe(200);
    expect(res.body.product.quantity).toBe(20);

    const movement = await Movement.findOne({ productId: created._id, delta: 15 });
    expect(movement).not.toBeNull();
    expect(movement.reason).toBe("Restock Shipment");
    expect(movement.runningBalance).toBe(20);
  });

  it("PATCH /api/products/:id/stock - prevents stock below zero", async () => {
    const created = await Product.create(sample);
    const res = await request(app)
      .patch(`/api/products/${created._id}/stock`)
      .send({ delta: -10, reason: "Over-sale" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/below zero/i);
  });

  it("GET /api/alerts - returns products with quantity <= lowStockThreshold", async () => {
    await Product.create(sample); // qty: 5, threshold: 10 -> ALERT
    await Product.create({
      ...sample,
      sku: "KB-002",
      quantity: 50,
      lowStockThreshold: 10,
    }); // qty: 50 -> OK

    const res = await request(app).get("/api/alerts");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].sku).toBe("KB-001");
  });

  it("GET /api/movements - returns movement history", async () => {
    const p = await Product.create(sample);
    await Movement.create({
      productId: p._id,
      productName: p.name,
      sku: p.sku,
      delta: 5,
      reason: "Initial Stock",
      runningBalance: 5,
    });

    const res = await request(app).get("/api/movements?limit=10");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].reason).toBe("Initial Stock");
  });

  it("GET /api/stats - returns inventory analytics", async () => {
    await Product.create(sample); // 5 * 99.99 = 499.95
    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(200);
    expect(res.body.totalProducts).toBe(1);
    expect(res.body.totalStock).toBe(5);
    expect(res.body.lowStockCount).toBe(1);
    expect(res.body.valueByCategory.length).toBe(1);
  });

  it("DELETE /api/products/:id - deletes product and cleans up movements", async () => {
    const created = await Product.create(sample);
    await Movement.create({
      productId: created._id,
      productName: created.name,
      sku: created.sku,
      delta: 5,
      reason: "Initial Stock",
      runningBalance: 5,
    });

    const res = await request(app).delete(`/api/products/${created._id}`);
    expect(res.status).toBe(200);

    const checkProduct = await Product.findById(created._id);
    expect(checkProduct).toBeNull();

    const checkMovements = await Movement.find({ productId: created._id });
    expect(checkMovements.length).toBe(0);
  });
});
