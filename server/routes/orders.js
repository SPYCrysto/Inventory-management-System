import { Router } from "express";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Movement from "../models/Movement.js";

const router = Router();

// GET /api/orders (type: 'purchase' | 'sales')
router.get("/", async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders (create purchase/sales order)
router.post("/", async (req, res) => {
  try {
    const { type, partyName, partyGstin, items = [], warehouse, notes } = req.body;

    if (!type || !partyName || items.length === 0) {
      return res.status(400).json({ error: "Type, party name, and at least one item are required" });
    }

    if (type !== "purchase" && type !== "sales") {
      return res.status(400).json({ error: "Order type must be 'purchase' or 'sales'" });
    }

    const orderNumber = `${type === "purchase" ? "PO" : "SO"}-${Date.now().toString().slice(-6)}`;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    let subtotal = 0;
    let gstTotal = 0;

    const processedItems = [];
    const stockOps = [];

    for (const item of items) {
      const qty = parseInt(item.quantity, 10);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ error: "Each item must have a positive quantity" });
      }
      const unitPrice = parseFloat(item.unitPrice) || 0;
      if (unitPrice < 0) {
        return res.status(400).json({ error: "Unit price cannot be negative" });
      }
      const gstRate = [0, 5, 12, 18, 28].includes(parseInt(item.gstRate, 10))
        ? parseInt(item.gstRate, 10)
        : 18;

      const baseTotal = qty * unitPrice;
      const itemGst = (baseTotal * gstRate) / 100;

      subtotal += baseTotal;
      gstTotal += itemGst;

      processedItems.push({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: qty,
        unitPrice,
        gstRate,
        itemTotal: Math.round((baseTotal + itemGst) * 100) / 100,
      });

      // Validate stock availability before mutating anything
      if (item.productId) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(400).json({ error: `Product not found for item '${item.productName || item.sku || ""}'` });
        }
        const delta = type === "purchase" ? qty : -qty;
        const newQty = product.quantity + delta;
        if (newQty < 0) {
          return res.status(400).json({
            error: `Insufficient stock for '${product.name}'. Available: ${product.quantity}, requested: ${qty}`,
          });
        }
        stockOps.push({ product, delta, newQty });
      }
    }

    const grandTotal = Math.round((subtotal + gstTotal) * 100) / 100;

    const order = await Order.create({
      orderNumber,
      type,
      partyName: partyName.trim(),
      partyGstin: partyGstin?.trim().toUpperCase() || "",
      items: processedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      gstTotal: Math.round(gstTotal * 100) / 100,
      grandTotal,
      warehouse: warehouse || "Main Hub (Bengaluru)",
      status: "fulfilled",
      invoiceNumber,
      notes: notes || "",
    });

    // Update inventory only after the order record exists
    for (const op of stockOps) {
      op.product.quantity = op.newQty;
      await op.product.save();

      await Movement.create({
        productId: op.product._id,
        productName: op.product.name,
        sku: op.product.sku,
        delta: op.delta,
        reason: `${type === "purchase" ? "Purchase Order Inward" : "Sales Order Outward"} (${orderNumber})`,
        runningBalance: op.newQty,
      });
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
