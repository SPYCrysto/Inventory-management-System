import { Router } from "express";
import Product from "../models/Product.js";
import Movement from "../models/Movement.js";

const router = Router();

// GET /api/products (list with search, category, status, warehouse filters, and sort)
router.get("/", async (req, res) => {
  try {
    const {
      search,
      category,
      status,
      warehouse,
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    const query = {};

    // Search by name, SKU, category, or barcode
    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { sku: { $regex: term, $options: "i" } },
        { category: { $regex: term, $options: "i" } },
        { barcode: { $regex: term, $options: "i" } },
        { supplier: { $regex: term, $options: "i" } },
      ];
    }

    // Filter by Category
    if (category && category !== "All") {
      query.category = category;
    }

    // Filter by Warehouse
    if (warehouse && warehouse !== "All") {
      query.warehouse = warehouse;
    }

    // Filter by Status
    if (status === "out_of_stock") {
      query.quantity = { $lte: 0 };
    } else if (status === "low_stock") {
      query.$expr = {
        $and: [
          { $gt: ["$quantity", 0] },
          { $lte: ["$quantity", "$lowStockThreshold"] },
        ],
      };
    } else if (status === "in_stock") {
      query.$expr = {
        $gt: ["$quantity", "$lowStockThreshold"],
      };
    } else if (status === "damaged") {
      query.status = "damaged";
    }

    // Sorting
    const sort = {};
    const order = sortOrder === "desc" ? -1 : 1;
    if (
      [
        "quantity",
        "price",
        "costPrice",
        "createdAt",
        "name",
        "category",
        "warehouse",
      ].includes(sortBy)
    ) {
      sort[sortBy] = order;
    } else {
      sort.name = 1;
    }

    const products = await Product.find(query).sort(sort);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/import (Feature #50: Product Import from CSV/Excel)
router.post("/import", async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided for import" });
    }

    let importedCount = 0;
    let updatedCount = 0;
    const errors = [];
    const movementsToCreate = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name || !item.sku) {
        errors.push(`Row ${i + 1}: Name and SKU are required`);
        continue;
      }

      const sku = item.sku.trim().toUpperCase();
      const existing = await Product.findOne({ sku });

      const parsedQty = Math.max(0, parseInt(item.quantity, 10) || 0);
      const parsedPrice = Math.max(0, parseFloat(item.price) || 0);
      const parsedCost = Math.max(0, parseFloat(item.costPrice) || 0);
      const parsedThreshold = Math.max(
        0,
        parseInt(item.lowStockThreshold, 10) || 10
      );
      const parsedGst = [0, 5, 12, 18, 28].includes(parseInt(item.gstRate, 10))
        ? parseInt(item.gstRate, 10)
        : 18;

      if (existing) {
        // Update existing item
        const delta = parsedQty - existing.quantity;
        existing.name = item.name.trim();
        existing.category = item.category?.trim() || existing.category;
        existing.price = parsedPrice || existing.price;
        existing.costPrice = parsedCost || existing.costPrice;
        existing.lowStockThreshold = parsedThreshold || existing.lowStockThreshold;
        existing.warehouse = item.warehouse?.trim() || existing.warehouse;
        existing.supplier = item.supplier?.trim() || existing.supplier;
        existing.barcode = item.barcode?.trim() || existing.barcode;
        existing.gstRate = parsedGst;
        existing.quantity = parsedQty;

        await existing.save();
        updatedCount++;

        if (delta !== 0) {
          movementsToCreate.push({
            productId: existing._id,
            productName: existing.name,
            sku: existing.sku,
            delta,
            reason: `CSV Import Reconciliation (${delta > 0 ? "+" : ""}${delta})`,
            runningBalance: parsedQty,
          });
        }
      } else {
        // Create new item
        const newProduct = await Product.create({
          name: item.name.trim(),
          sku,
          category: item.category?.trim() || "General",
          quantity: parsedQty,
          price: parsedPrice,
          costPrice: parsedCost,
          lowStockThreshold: parsedThreshold,
          warehouse: item.warehouse?.trim() || "Main Hub (Bengaluru)",
          supplier: item.supplier?.trim() || "Direct Vendor",
          batchNumber: item.batchNumber?.trim() || "",
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          barcode: item.barcode?.trim() || sku,
          gstRate: parsedGst,
        });

        importedCount++;

        if (parsedQty > 0) {
          movementsToCreate.push({
            productId: newProduct._id,
            productName: newProduct.name,
            sku: newProduct.sku,
            delta: parsedQty,
            reason: "Initial CSV Import Stock",
            runningBalance: parsedQty,
          });
        }
      }
    }

    if (movementsToCreate.length > 0) {
      await Movement.insertMany(movementsToCreate);
    }

    res.json({
      message: `Import completed: ${importedCount} created, ${updatedCount} updated`,
      importedCount,
      updatedCount,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/:id/transfer (Feature #17: Stock Transfer Between Warehouses)
router.patch("/:id/transfer", async (req, res) => {
  try {
    const { fromWarehouse, toWarehouse, quantity, reason } = req.body;
    const qty = parseInt(quantity, 10);

    if (!toWarehouse || !qty || qty <= 0) {
      return res.status(400).json({ error: "Destination warehouse and positive quantity are required" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    if (product.quantity < qty) {
      return res.status(400).json({
        error: `Insufficient stock in ${fromWarehouse || product.warehouse}. Available: ${product.quantity}, Requested: ${qty}`,
      });
    }

    const previousWarehouse = product.warehouse;
    product.warehouse = toWarehouse;
    await product.save();

    await Movement.create({
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      delta: 0,
      reason: `Transfer [${previousWarehouse} ➔ ${toWarehouse}]: ${qty} units (${reason || "Inventory Rebalancing"})`,
      runningBalance: product.quantity,
    });

    res.json({
      message: `Transferred ${qty} units of ${product.name} to ${toWarehouse}`,
      product,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/products/seed (sample data with rich enterprise fields)
router.post("/seed", async (req, res) => {
  try {
    const count = await Product.countDocuments();
    if (count > 0 && !req.query.force) {
      return res.status(400).json({
        error: "Inventory is not empty. Pass ?force=true to overwrite sample data.",
      });
    }

    if (req.query.force) {
      await Product.deleteMany({});
      await Movement.deleteMany({});
    }

    const sampleProducts = [
      {
        name: "Ergonomic Mechanical Keyboard",
        sku: "KB-MECH-01",
        category: "Electronics",
        quantity: 24,
        lowStockThreshold: 10,
        price: 89.99,
        costPrice: 52.0,
        warehouse: "Main Hub (Bengaluru)",
        supplier: "Logitech Systems India",
        batchNumber: "B2026-03",
        expiryDate: null,
        serialNumber: "SN-KB-88902",
        barcode: "8901234567890",
        gstRate: 18,
        variants: [
          { name: "Blue Switch", sku: "KB-MECH-01-BLU", quantity: 14, price: 89.99 },
          { name: "Brown Switch", sku: "KB-MECH-01-BRN", quantity: 10, price: 94.99 },
        ],
      },
      {
        name: "Wireless Noise-Canceling Headphones",
        sku: "AUD-HDPH-02",
        category: "Electronics",
        quantity: 6,
        lowStockThreshold: 8,
        price: 149.5,
        costPrice: 95.0,
        warehouse: "North Warehouse (Delhi)",
        supplier: "Sony Electronics Corp",
        batchNumber: "B2026-01",
        expiryDate: null,
        serialNumber: "SN-AUD-44102",
        barcode: "8909876543210",
        gstRate: 18,
      },
      {
        name: "USB-C Ultra Docking Station 10-in-1",
        sku: "ACC-DOCK-03",
        category: "Electronics",
        quantity: 4,
        lowStockThreshold: 5,
        price: 79.0,
        costPrice: 42.0,
        warehouse: "Main Hub (Bengaluru)",
        supplier: "Anker Technologies",
        batchNumber: "B2026-02",
        barcode: "8901122334455",
        gstRate: 18,
      },
      {
        name: "Anodized Aluminum Laptop Stand",
        sku: "ACC-STND-04",
        category: "Accessories",
        quantity: 32,
        lowStockThreshold: 10,
        price: 34.99,
        costPrice: 16.5,
        warehouse: "West Hub (Mumbai)",
        supplier: "MetalWorks Design Ltd",
        barcode: "8906677889900",
        gstRate: 12,
      },
      {
        name: "Precision Gaming Mouse with RGB",
        sku: "PER-MOUS-05",
        category: "Electronics",
        quantity: 2,
        lowStockThreshold: 6,
        price: 49.99,
        costPrice: 28.0,
        warehouse: "North Warehouse (Delhi)",
        supplier: "Razer Logistics",
        barcode: "8905544332211",
        gstRate: 18,
      },
      {
        name: "Premium Desk Mat (900x400mm)",
        sku: "OFF-DMAT-06",
        category: "Office",
        quantity: 0,
        lowStockThreshold: 10,
        price: 24.5,
        costPrice: 9.0,
        warehouse: "Main Hub (Bengaluru)",
        supplier: "DeskSetup Pro",
        barcode: "8903322114455",
        gstRate: 12,
      },
      {
        name: "Dual Gas-Spring Monitor Arm Mount",
        sku: "FUR-MARM-07",
        category: "Furniture",
        quantity: 14,
        lowStockThreshold: 5,
        price: 65.0,
        costPrice: 38.0,
        warehouse: "West Hub (Mumbai)",
        supplier: "ErgoFurniture India",
        barcode: "8907788990011",
        gstRate: 18,
      },
      {
        name: "Hardcover Dotted Journal (A5, 120GSM)",
        sku: "STA-JRNL-08",
        category: "Stationery",
        quantity: 60,
        lowStockThreshold: 15,
        price: 12.0,
        costPrice: 4.5,
        warehouse: "Main Hub (Bengaluru)",
        supplier: "PaperCraft Mills",
        barcode: "8901239874561",
        gstRate: 5,
      },
      {
        name: "Double-Wall Insulated Tumbler (750ml)",
        sku: "KIT-TMBL-09",
        category: "Kitchenware",
        quantity: 8,
        lowStockThreshold: 12,
        price: 19.99,
        costPrice: 8.0,
        warehouse: "West Hub (Mumbai)",
        supplier: "HydroWare Industries",
        batchNumber: "B2025-11",
        expiryDate: new Date("2028-12-31"),
        barcode: "8909871236547",
        gstRate: 12,
      },
      {
        name: "Braided 100W USB-C PD Cable (2m)",
        sku: "ACC-CBL-10",
        category: "Accessories",
        quantity: 3,
        lowStockThreshold: 15,
        price: 9.99,
        costPrice: 3.2,
        warehouse: "North Warehouse (Delhi)",
        supplier: "Anker Technologies",
        barcode: "8904561237890",
        gstRate: 18,
      },
    ];

    const created = await Product.insertMany(sampleProducts);

    const movements = created
      .filter((p) => p.quantity > 0)
      .map((p) => ({
        productId: p._id,
        productName: p.name,
        sku: p.sku,
        delta: p.quantity,
        reason: "Initial Enterprise Inventory Setup",
        runningBalance: p.quantity,
      }));

    if (movements.length > 0) {
      await Movement.insertMany(movements);
    }

    res.status(201).json({
      message: `Seeded ${created.length} enterprise products successfully`,
      count: created.length,
      products: created,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products (create with enterprise attributes)
router.post("/", async (req, res) => {
  try {
    const {
      name,
      sku,
      category,
      quantity = 0,
      lowStockThreshold = 10,
      price = 0,
      costPrice = 0,
      warehouse = "Main Hub (Bengaluru)",
      supplier = "Direct Vendor",
      batchNumber = "",
      expiryDate = null,
      serialNumber = "",
      barcode = "",
      gstRate = 18,
      variants = [],
    } = req.body;

    if (!name || !sku) {
      return res.status(400).json({ error: "Name and SKU are required" });
    }

    const existing = await Product.findOne({ sku: sku.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({ error: `SKU '${sku}' already exists` });
    }

    const parsedQty = Math.max(0, parseInt(quantity, 10) || 0);
    const parsedPrice = Math.max(0, parseFloat(price) || 0);
    const parsedCost = Math.max(0, parseFloat(costPrice) || 0);
    const parsedThreshold = Math.max(0, parseInt(lowStockThreshold, 10) || 10);

    const product = await Product.create({
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      category: category ? category.trim() : "General",
      quantity: parsedQty,
      lowStockThreshold: parsedThreshold,
      price: parsedPrice,
      costPrice: parsedCost,
      warehouse: warehouse.trim(),
      supplier: supplier.trim(),
      batchNumber: batchNumber.trim(),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      serialNumber: serialNumber.trim(),
      barcode: barcode.trim() || sku.trim().toUpperCase(),
      gstRate: parseInt(gstRate, 10) || 18,
      variants: Array.isArray(variants) ? variants : [],
    });

    if (parsedQty > 0) {
      await Movement.create({
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        delta: parsedQty,
        reason: "Initial Stock",
        runningBalance: parsedQty,
      });
    }

    res.status(201).json(product);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "A product with this SKU already exists" });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/products/:id (edit)
router.put("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const fields = [
      "name",
      "category",
      "warehouse",
      "supplier",
      "batchNumber",
      "serialNumber",
      "barcode",
      "status",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) product[f] = req.body[f];
    });

    if (req.body.sku && req.body.sku.trim().toUpperCase() !== product.sku) {
      const duplicate = await Product.findOne({
        sku: req.body.sku.trim().toUpperCase(),
      });
      if (duplicate) {
        return res
          .status(400)
          .json({ error: `SKU '${req.body.sku}' already exists` });
      }
      product.sku = req.body.sku.trim().toUpperCase();
    }

    if (req.body.price !== undefined)
      product.price = Math.max(0, parseFloat(req.body.price) || 0);
    if (req.body.costPrice !== undefined)
      product.costPrice = Math.max(0, parseFloat(req.body.costPrice) || 0);
    if (req.body.lowStockThreshold !== undefined)
      product.lowStockThreshold = Math.max(
        0,
        parseInt(req.body.lowStockThreshold, 10) || 0
      );
    if (req.body.gstRate !== undefined)
      product.gstRate = parseInt(req.body.gstRate, 10) || 18;
    if (req.body.expiryDate !== undefined)
      product.expiryDate = req.body.expiryDate
        ? new Date(req.body.expiryDate)
        : null;
    if (Array.isArray(req.body.variants)) product.variants = req.body.variants;

    // Quantity update
    if (req.body.quantity !== undefined) {
      const newQty = Math.max(0, parseInt(req.body.quantity, 10) || 0);
      const delta = newQty - product.quantity;
      if (delta !== 0) {
        product.quantity = newQty;
        await Movement.create({
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          delta,
          reason: "Manual Inventory Reconciliation",
          runningBalance: newQty,
        });
      }
    }

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/products/:id/stock ({ delta, reason } - never below zero)
router.patch("/:id/stock", async (req, res) => {
  try {
    const { delta, reason } = req.body;
    const change = parseInt(delta, 10);

    if (isNaN(change) || change === 0) {
      return res.status(400).json({ error: "Delta must be a non-zero integer" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const newQuantity = product.quantity + change;
    if (newQuantity < 0) {
      return res.status(400).json({
        error: `Cannot reduce stock below zero. Current stock: ${product.quantity}, requested reduction: ${Math.abs(change)}`,
      });
    }

    product.quantity = newQuantity;
    await product.save();

    const movement = await Movement.create({
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      delta: change,
      reason:
        reason && reason.trim()
          ? reason.trim()
          : change > 0
          ? "Stock In"
          : "Stock Out",
      runningBalance: newQuantity,
    });

    res.json({
      product,
      movement,
      message: `Stock updated by ${change > 0 ? "+" + change : change}. Current stock: ${newQuantity}`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    await Movement.deleteMany({ productId: product._id });
    res.json({ message: "Product deleted successfully", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
