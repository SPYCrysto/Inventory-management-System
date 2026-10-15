import { Router } from "express";
import Product from "../models/Product.js";

const router = Router();

// GET /api/alerts - Products where quantity <= lowStockThreshold
router.get("/", async (req, res) => {
  try {
    const alerts = await Product.find({
      $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
    }).sort({ quantity: 1, name: 1 });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
