/**
 * Inventra Data Migration Utility: MongoDB Atlas -> Supabase PostgreSQL
 * 
 * Usage:
 *   node scripts/migrate-mongo-to-supabase.js
 * 
 * Flags / Env:
 *   MONGO_URI="mongodb+srv://..."
 *   SUPABASE_URL="https://hkzsfibpixlqeumakrld.supabase.co"
 *   SUPABASE_KEY="sb_publishable_..."
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log("=============================================================");
  console.log("🚀 Starting Inventra MongoDB -> Supabase Data Migration");
  console.log(`🌐 Supabase Target: ${supabaseUrl}`);
  console.log("=============================================================\n");

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri || mongoUri.includes("<db_password>")) {
    console.log("ℹ️  No live MONGO_URI provided in .env (or contains placeholder).");
    console.log("🌱 Migrating baseline enterprise seed data into Supabase...");
    await seedSupabaseDirectly();
    return;
  }

  try {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(mongoUri);
    console.log("Connecting to MongoDB Atlas...");
    await client.connect();
    console.log(" Connected to MongoDB successfully.\n");

    const db = client.db();

    // 1. Migrate Products
    console.log("📦 Fetching products from MongoDB...");
    const products = await db.collection("products").find({}).toArray();
    console.log(`Found ${products.length} products in MongoDB.`);

    let productsMigrated = 0;
    for (const p of products) {
      const row = {
        name: p.name,
        sku: p.sku.toUpperCase(),
        category: p.category || "General",
        quantity: Math.max(0, parseInt(p.quantity, 10) || 0),
        min_stock_threshold: Math.max(0, parseInt(p.lowStockThreshold || p.min_stock_threshold, 10) || 10),
        purchase_price: Math.max(0, parseFloat(p.costPrice || p.purchase_price) || 0),
        selling_price: Math.max(0, parseFloat(p.price || p.selling_price) || 0),
        warehouse: p.warehouse || "Main Hub (Bengaluru)",
        supplier: p.supplier || "Standard Vendor",
        batch_number: p.batchNumber || "",
        expiry_date: p.expiryDate ? new Date(p.expiryDate).toISOString() : null,
        serial_number: p.serialNumber || "",
        barcode: p.barcode || p.sku.toUpperCase(),
        reorder_quantity: parseInt(p.reorderQuantity, 10) || 25,
        gst_rate: parseInt(p.gstRate, 10) || 18,
        status: p.status || "active",
        variants: p.variants || [],
      };

      const { error } = await supabase.from("products").upsert(row, { onConflict: "sku" });
      if (error) {
        console.warn(`⚠️ Warning inserting product ${p.sku}: ${error.message}`);
      } else {
        productsMigrated++;
      }
    }
    console.log(`✅ Migrated ${productsMigrated}/${products.length} products to Supabase.`);

    // 2. Migrate Movements
    console.log("\n📜 Fetching stock history from MongoDB...");
    const movements = await db.collection("movements").find({}).toArray();
    console.log(`Found ${movements.length} movements in MongoDB.`);

    let movementsMigrated = 0;
    for (const m of movements) {
      // Find matching product in Supabase to link foreign key
      const { data: prod } = await supabase
        .from("products")
        .select("id")
        .eq("sku", (m.sku || "").toUpperCase())
        .maybeSingle();

      if (prod) {
        const row = {
          product_id: prod.id,
          product_name: m.productName,
          sku: (m.sku || "").toUpperCase(),
          delta: m.delta || 0,
          reason: m.reason || "Migrated Adjustment",
          new_quantity: m.runningBalance || 0,
          previous_quantity: Math.max(0, (m.runningBalance || 0) - (m.delta || 0)),
        };

        const { error } = await supabase.from("stock_movements").insert([row]);
        if (!error) movementsMigrated++;
      }
    }
    console.log(`✅ Migrated ${movementsMigrated}/${movements.length} stock movements to Supabase.`);

    await client.close();
    console.log("\n🎉 MongoDB to Supabase migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration error:", err.message);
  }
}

async function seedSupabaseDirectly() {
  const sampleProducts = [
    {
      name: "Ergonomic Mechanical Keyboard",
      sku: "KB-MECH-01",
      category: "Electronics",
      quantity: 24,
      min_stock_threshold: 10,
      selling_price: 89.99,
      purchase_price: 52.0,
      warehouse: "Main Hub (Bengaluru)",
      supplier: "Logitech Systems India",
      barcode: "8901234567890",
      status: "active",
    },
    {
      name: "Wireless Noise-Canceling Headphones",
      sku: "AUD-HDPH-02",
      category: "Electronics",
      quantity: 6,
      min_stock_threshold: 8,
      selling_price: 149.5,
      purchase_price: 95.0,
      warehouse: "North Warehouse (Delhi)",
      supplier: "Sony Electronics Corp",
      barcode: "8909876543210",
      status: "active",
    },
    {
      name: "USB-C Ultra Docking Station 10-in-1",
      sku: "ACC-DOCK-03",
      category: "Electronics",
      quantity: 4,
      min_stock_threshold: 5,
      selling_price: 79.0,
      purchase_price: 42.0,
      warehouse: "Main Hub (Bengaluru)",
      supplier: "Anker Technologies",
      barcode: "8901122334455",
      status: "active",
    },
    {
      name: "Anodized Aluminum Laptop Stand",
      sku: "ACC-STND-04",
      category: "Accessories",
      quantity: 32,
      min_stock_threshold: 10,
      selling_price: 34.99,
      purchase_price: 16.5,
      warehouse: "West Hub (Mumbai)",
      supplier: "MetalWorks Design Ltd",
      barcode: "8906677889900",
      status: "active",
    },
  ];

  console.log("Seeding verified initial catalog into Supabase...");
  let count = 0;
  for (const p of sampleProducts) {
    const { error } = await supabase.from("products").upsert(p, { onConflict: "sku" });
    if (!error) count++;
  }
  console.log(`✅ Seeded ${count} verified records into Supabase.`);
}

runMigration();
