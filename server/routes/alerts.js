import { Router } from "express";
import Product from "../models/Product.js";

const router = Router();

// GET /api/alerts - Products where quantity <= lowStockThreshold
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({}).sort({ quantity: 1, name: 1 });
    const alerts = products.filter(
      (p) => (p.quantity || 0) <= (p.lowStockThreshold ?? 10)
    );

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
