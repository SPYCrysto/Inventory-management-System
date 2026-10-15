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

    const orderNumber = `${type === "purchase" ? "PO" : "SO"}-${Date.now().toString().slice(-6)}`;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    let subtotal = 0;
    let gstTotal = 0;

    const processedItems = [];

    for (const item of items) {
      const qty = parseInt(item.quantity, 10) || 1;
      const unitPrice = parseFloat(item.unitPrice) || 0;
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

      // Update inventory stock based on order type!
      if (item.productId) {
        const delta = type === "purchase" ? qty : -qty;
        const product = await Product.findById(item.productId);
        if (product) {
          product.quantity = Math.max(0, product.quantity + delta);
          await product.save();

          await Movement.create({
            productId: product._id,
            productName: product.name,
            sku: product.sku,
            delta,
            reason: `${type === "purchase" ? "Purchase Order Inward" : "Sales Order Outward"} (${orderNumber})`,
            runningBalance: product.quantity,
          });
        }
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

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
