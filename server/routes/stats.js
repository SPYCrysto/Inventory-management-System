import { Router } from "express";
import Product from "../models/Product.js";
import Movement from "../models/Movement.js";

const router = Router();

// GET /api/stats - Dashboard metrics and aggregations
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({});
    const totalProducts = products.length;

    let totalStock = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const categoryMap = {};

    for (const p of products) {
      const qty = p.quantity || 0;
      const price = p.price || 0;
      const val = qty * price;

      totalStock += qty;
      totalValue += val;

      if (qty === 0) {
        outOfStockCount++;
      }
      if (qty <= (p.lowStockThreshold || 10)) {
        lowStockCount++;
      }

      const cat = p.category || "General";
      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          category: cat,
          totalValue: 0,
          totalStock: 0,
          productCount: 0,
        };
      }
      categoryMap[cat].totalValue += val;
      categoryMap[cat].totalStock += qty;
      categoryMap[cat].productCount++;
    }

    const valueByCategory = Object.values(categoryMap).sort(
      (a, b) => b.totalValue - a.totalValue
    );

    // Fetch the 5 latest movements
    const latestMovements = await Movement.find({})
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalProducts,
      totalStock,
      totalValue: Math.round(totalValue * 100) / 100,
      lowStockCount,
      outOfStockCount,
      valueByCategory,
      latestMovements,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
