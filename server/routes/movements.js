import { Router } from "express";
import Movement from "../models/Movement.js";

const router = Router();

// GET /api/movements?limit= - Stock history log
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { productId, type } = req.query;

    const filter = {};
    if (productId) filter.productId = productId;
    if (type === "in") filter.delta = { $gt: 0 };
    if (type === "out") filter.delta = { $lt: 0 };

    const movements = await Movement.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
