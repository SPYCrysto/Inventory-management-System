import { Router } from "express";
import Supplier from "../models/Supplier.js";

const router = Router();

// GET /api/suppliers
router.get("/", async (req, res) => {
  try {
    const suppliers = await Supplier.find({}).sort({ name: 1 });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/suppliers
router.post("/", async (req, res) => {
  try {
    const { name, code, contactPerson, email, phone, gstin, city, paymentTerms } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: "Supplier name and code are required" });
    }

    const supplier = await Supplier.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      contactPerson: contactPerson?.trim() || "",
      email: email?.trim() || "",
      phone: phone?.trim() || "",
      gstin: gstin?.trim().toUpperCase() || "",
      city: city?.trim() || "Mumbai",
      paymentTerms: paymentTerms || "Net 30",
    });

    res.status(201).json(supplier);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Supplier code already exists" });
    }
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/suppliers/:id
router.delete("/:id", async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    res.json({ message: "Supplier deleted", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/suppliers/seed
router.post("/seed", async (req, res) => {
  try {
    const count = await Supplier.countDocuments();
    if (count > 0 && !req.query.force) {
      return res.status(400).json({ error: "Suppliers already exist" });
    }

    const sample = [
      {
        name: "Logitech Systems India",
        code: "SUP-LOGI-01",
        contactPerson: "Rajesh Sharma",
        email: "rajesh@logitech-supply.in",
        phone: "+91 98200 12345",
        gstin: "29AABCL1234F1Z8",
        city: "Bengaluru",
      },
      {
        name: "Sony Electronics Corp",
        code: "SUP-SONY-02",
        contactPerson: "Ananya Desai",
        email: "orders@sony-distribution.in",
        phone: "+91 98111 54321",
        gstin: "27AABCS9876E1Z4",
        city: "Mumbai",
      },
      {
        name: "Anker Technologies",
        code: "SUP-ANKR-03",
        contactPerson: "Vikram Malhotra",
        email: "supply@anker-india.com",
        phone: "+91 97177 99882",
        gstin: "07AABCA4321P1Z2",
        city: "Delhi",
      },
      {
        name: "PaperCraft Mills",
        code: "SUP-PAPR-04",
        contactPerson: "Suresh Patel",
        email: "sales@papercraft.co.in",
        phone: "+91 99090 33441",
        gstin: "24AABCP5678Q1Z9",
        city: "Ahmedabad",
      },
    ];

    if (req.query.force) await Supplier.deleteMany({});
    const created = await Supplier.insertMany(sample);
    res.status(201).json({ message: "Seeded suppliers", count: created.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
