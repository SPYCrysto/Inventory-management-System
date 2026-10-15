import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db.js";

import productRoutes from "./routes/products.js";
import alertRoutes from "./routes/alerts.js";
import movementRoutes from "./routes/movements.js";
import statsRoutes from "./routes/stats.js";
import healthRoutes from "./routes/health.js";
import supplierRoutes from "./routes/suppliers.js";
import orderRoutes from "./routes/orders.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Supabase Connection middleware
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api")) {
    try {
      await connectDB();
    } catch (err) {
      console.warn("Supabase check error:", err.message);
    }
  }
  next();
});

// Mount API routes
app.use("/api/products", productRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/movements", movementRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/orders", orderRoutes);

// In local production mode or standalone mode, serve built Vite assets from dist/
const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

const PORT = process.env.PORT || 5000;

// Only listen if not imported into a serverless handler or running in test mode
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  const startApp = () => {
    const server = app.listen(PORT, () => {
      console.log(`Inventra API server (Supabase Backend) running on http://localhost:${PORT}`);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`[Port Alert] Port ${PORT} is already in use by an active instance. Serving on existing process.`);
      } else {
        console.error("Server listen error:", err.message);
      }
    });
  };

  connectDB()
    .then(() => {
      console.log("Connected to Supabase Backend successfully!");
      startApp();
    })
    .catch((err) => {
      console.warn("Starting Express with Supabase client:", err.message);
      startApp();
    });
}

export default app;
