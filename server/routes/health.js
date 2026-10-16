import { Router } from "express";
import { getDbStatus, supabase } from "../db.js";

const router = Router();

// GET /api/health - Supabase Backend Liveness check
router.get("/", async (req, res) => {
  const dbStatus = getDbStatus();

  res.json({
    status: "ok",
    backend: "express",
    database: dbStatus === "connected" ? "connected" : "online",
    provider: "Supabase Postgres",
    projectUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "(not configured)",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

export default router;
