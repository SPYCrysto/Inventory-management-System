import { supabase, DB_ENABLED } from "../supabase.js";
import { productToRow, rowToProduct, generateId, Query } from "./storeHelper.js";

// In-memory fallback cache (used when Supabase table has not been migrated yet)
let memoryStore = new Map();

const DEFAULT_PRODUCTS = [
  {
    id: "prod-kb-01",
    _id: "prod-kb-01",
    name: "Ergonomic Mechanical Keyboard",
    sku: "KB-MECH-01",
    category: "Electronics",
    quantity: 28,
    lowStockThreshold: 10,
    price: 89.99,
    costPrice: 52.0,
    warehouse: "Main Hub (Bengaluru)",
    supplier: "Logitech Systems India",
    barcode: "8901234567890",
    location: "Aisle 3, Rack A2",
    batchNumber: "B2026-03",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prod-aud-02",
    _id: "prod-aud-02",
    name: "Wireless Noise-Canceling Headphones",
    sku: "AUD-HDPH-02",
    category: "Electronics",
    quantity: 6,
    lowStockThreshold: 8,
    price: 149.5,
    costPrice: 95.0,
    warehouse: "North Warehouse (Delhi)",
    supplier: "Sony Electronics Corp",
    barcode: "8909876543210",
    location: "Aisle 1, Rack C1",
    batchNumber: "B2026-01",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prod-dock-03",
    _id: "prod-dock-03",
    name: "USB-C Ultra Docking Station 10-in-1",
    sku: "ACC-DOCK-03",
    category: "Electronics",
    quantity: 4,
    lowStockThreshold: 5,
    price: 79.0,
    costPrice: 42.0,
    warehouse: "Main Hub (Bengaluru)",
    supplier: "Anker Technologies",
    barcode: "8904561237890",
    location: "Aisle 2, Bin 14",
    batchNumber: "B2026-02",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prod-mon-04",
    _id: "prod-mon-04",
    name: "Ultra-Wide 4K IPS Monitor 34-Inch",
    sku: "MON-4K-04",
    category: "Hardware",
    quantity: 15,
    lowStockThreshold: 5,
    price: 449.0,
    costPrice: 310.0,
    warehouse: "West Hub (Mumbai)",
    supplier: "Samsung Display Corp",
    barcode: "8907894561230",
    location: "Aisle 5, Pallet 02",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prod-mse-05",
    _id: "prod-mse-05",
    name: "Precision Ergonomic Vertical Mouse",
    sku: "MSE-VERT-05",
    category: "Peripherals",
    quantity: 42,
    lowStockThreshold: 12,
    price: 49.99,
    costPrice: 24.5,
    warehouse: "Main Hub (Bengaluru)",
    supplier: "Logitech Systems India",
    barcode: "8903216549870",
    location: "Aisle 3, Rack A4",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prod-riser-06",
    _id: "prod-riser-06",
    name: "Aluminum Heavy-Duty Laptop Riser",
    sku: "ACC-STAND-06",
    category: "Accessories",
    quantity: 35,
    lowStockThreshold: 10,
    price: 34.5,
    costPrice: 16.0,
    warehouse: "South Hub (Chennai)",
    supplier: "Satechi Hardware",
    barcode: "8906549873210",
    location: "Aisle 2, Bin 08",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prod-tb4-07",
    _id: "prod-tb4-07",
    name: "Thunderbolt 4 Pro Braided Cable 2M",
    sku: "CAB-TB4-07",
    category: "Accessories",
    quantity: 60,
    lowStockThreshold: 15,
    price: 29.99,
    costPrice: 11.2,
    warehouse: "Main Hub (Bengaluru)",
    supplier: "Belkin International",
    barcode: "8901472583690",
    location: "Aisle 2, Bin 03",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prod-mat-08",
    _id: "prod-mat-08",
    name: "Leather Executive Desk Blotter Mat",
    sku: "OFC-MAT-08",
    category: "Office",
    quantity: 18,
    lowStockThreshold: 8,
    price: 39.0,
    costPrice: 18.0,
    warehouse: "North Warehouse (Delhi)",
    supplier: "Grovemade Studio",
    barcode: "8902583691470",
    location: "Aisle 4, Shelf 01",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prod-prt-09",
    _id: "prod-prt-09",
    name: "Smart Thermal Label & Barcode Printer",
    sku: "PRT-THERM-09",
    category: "Hardware",
    quantity: 8,
    lowStockThreshold: 6,
    price: 189.0,
    costPrice: 120.0,
    warehouse: "Main Hub (Bengaluru)",
    supplier: "Zebra Technologies",
    barcode: "8903691472580",
    location: "Aisle 5, Rack D1",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prod-eth-10",
    _id: "prod-eth-10",
    name: "Cat6A High-Speed Shielded Cable 10m",
    sku: "CAB-NET-10",
    category: "Accessories",
    quantity: 0,
    lowStockThreshold: 10,
    price: 14.99,
    costPrice: 6.0,
    warehouse: "West Hub (Mumbai)",
    supplier: "Belkin International",
    barcode: "8909517534680",
    location: "Aisle 2, Bin 01",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prod-cam-11",
    _id: "prod-cam-11",
    name: "Full HD StreamCam Pro 60FPS",
    sku: "CAM-FHD-11",
    category: "Electronics",
    quantity: 12,
    lowStockThreshold: 6,
    price: 119.0,
    costPrice: 72.0,
    warehouse: "South Hub (Chennai)",
    supplier: "Logitech Systems India",
    barcode: "8907531594680",
    location: "Aisle 1, Rack B3",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prod-note-12",
    _id: "prod-note-12",
    name: "A5 Hardcover Dotted Grid Notebook",
    sku: "OFC-NOTE-12",
    category: "Office",
    quantity: 75,
    lowStockThreshold: 20,
    price: 12.5,
    costPrice: 4.8,
    warehouse: "North Warehouse (Delhi)",
    supplier: "Leuchtturm1917",
    barcode: "8908529637410",
    location: "Aisle 4, Shelf 05",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Pre-fill memoryStore with default demo inventory for immediate rich experience
function seedDefaultMemory() {
  for (const item of DEFAULT_PRODUCTS) {
    const totalValue = item.quantity * item.price;
    const totalCost = item.quantity * item.costPrice;
    const profitMargin =
      item.price > 0
        ? Math.round(((item.price - item.costPrice) / item.price) * 1000) / 10
        : 0;
    memoryStore.set(item._id, {
      ...item,
      totalValue,
      totalCost,
      profitMargin,
    });
  }
}

if (process.env.NODE_ENV !== "test") {
  seedDefaultMemory();
}

class ProductDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = this.id || this._id || generateId();
    this.id = this._id;
  }

  async save() {
    this.updatedAt = new Date();
    // Recompute virtuals
    this.totalValue = (this.quantity || 0) * (this.price || 0);
    this.totalCost = (this.quantity || 0) * (this.costPrice || 0);
    this.profitMargin =
      this.price > 0
        ? Math.round(((this.price - (this.costPrice || 0)) / this.price) * 1000) / 10
        : 0;

    const memoryKey = this._id;
    memoryStore.set(memoryKey, { ...this });

    if (!DB_ENABLED) return this;

    try {
      const row = productToRow(this);
      const { data, error } = await supabase
        .from("products")
        .upsert(row, { onConflict: "id" })
        .select()
        .single();

      if (error) {
        console.warn(`Supabase products write failed (${error.code || "unknown"}): ${error.message}`);
      } else if (data) {
        const mapped = rowToProduct(data);
        Object.assign(this, mapped);
        if (mapped._id !== memoryKey) {
          memoryStore.delete(memoryKey);
          memoryStore.set(mapped._id, { ...this });
        } else {
          memoryStore.set(memoryKey, { ...this });
        }
      }
    } catch {
      // Supabase table not present; memory store holds the state
    }
    return this;
  }

  toJSON() {
    return {
      _id: this._id,
      id: this.id,
      name: this.name,
      sku: this.sku,
      category: this.category,
      quantity: this.quantity,
      lowStockThreshold: this.lowStockThreshold,
      price: this.price,
      costPrice: this.costPrice,
      warehouse: this.warehouse,
      supplier: this.supplier,
      batchNumber: this.batchNumber,
      expiryDate: this.expiryDate,
      serialNumber: this.serialNumber,
      barcode: this.barcode,
      reorderQuantity: this.reorderQuantity,
      gstRate: this.gstRate,
      status: this.status,
      variants: this.variants,
      totalValue: this.totalValue,
      totalCost: this.totalCost,
      profitMargin: this.profitMargin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

class ProductModel {
  static find(filter = {}) {
    return new Query(async () => {
      let items = [];

      if (DB_ENABLED) {
        try {
          const { data, error } = await supabase
            .from("products")
            .select("*")
            .order("created_at", { ascending: false });

          if (error) {
            console.warn(`Supabase products read failed (${error.code || "unknown"}): ${error.message}`);
            items = Array.from(memoryStore.values());
          } else if (Array.isArray(data)) {
            if (data.length > 0) {
              items = data.map(rowToProduct);
              items.forEach((p) => memoryStore.set(p._id, p));
            } else if (memoryStore.size > 0) {
              items = Array.from(memoryStore.values());
              if (process.env.NODE_ENV !== "test") {
                const rows = items.map(productToRow);
                supabase.from("products").upsert(rows, { onConflict: "id" }).then(() => {}).catch(() => {});
              }
            }
          } else {
            items = Array.from(memoryStore.values());
          }
        } catch {
          items = Array.from(memoryStore.values());
        }
      } else {
        items = Array.from(memoryStore.values());
      }

      let result = items.map((p) => new ProductDocument(p));

      if (filter) {
        if (filter.category && filter.category !== "All") {
          result = result.filter((p) => p.category === filter.category);
        }
        if (filter.warehouse && filter.warehouse !== "All") {
          result = result.filter((p) => p.warehouse === filter.warehouse);
        }
        if (filter.status === "damaged") {
          result = result.filter((p) => p.status === "damaged");
        }
        if (filter.status === "out_of_stock") {
          result = result.filter((p) => (p.quantity || 0) <= 0);
        }
        if (filter.status === "low_stock") {
          result = result.filter((p) => p.quantity > 0 && p.quantity <= p.lowStockThreshold);
        }
        if (filter.status === "in_stock") {
          result = result.filter((p) => p.quantity > p.lowStockThreshold);
        }
        if (filter.$or && Array.isArray(filter.$or)) {
          result = result.filter((p) => {
            return filter.$or.some((clause) => {
              for (const [key, val] of Object.entries(clause)) {
                if (val?.$regex) {
                  const reg = new RegExp(val.$regex, val.$options || "i");
                  if (reg.test(p[key] || "")) return true;
                }
              }
              return false;
            });
          });
        }
      }

      return result;
    });
  }

  static async findOne(filter = {}) {
    const list = await this.find();
    if (filter.sku) {
      const target = filter.sku.toUpperCase();
      return list.find((p) => p.sku?.toUpperCase() === target) || null;
    }
    if (filter._id || filter.id) {
      const targetId = filter._id || filter.id;
      return list.find((p) => p._id === targetId || p.id === targetId) || null;
    }
    return list[0] || null;
  }

  static async findById(id) {
    if (!id) return null;
    if (DB_ENABLED) {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (!error && data) {
          const mapped = rowToProduct(data);
          memoryStore.set(mapped._id, mapped);
          return new ProductDocument(mapped);
        }
      } catch {
        // Supabase table query fallback
      }
    }

    const mem = memoryStore.get(id);
    return mem ? new ProductDocument(mem) : null;
  }

  static async create(data) {
    const sku = (data.sku || "").trim().toUpperCase();

    // Check duplicate SKU
    const existing = await this.findOne({ sku });
    if (existing) {
      const err = new Error(`SKU '${sku}' already exists`);
      err.code = 11000;
      throw err;
    }

    const docId = data.id || data._id || generateId();
    const docData = {
      ...data,
      _id: docId,
      id: docId,
      sku,
      category: data.category || "General",
      quantity: Math.max(0, parseInt(data.quantity, 10) || 0),
      lowStockThreshold: Math.max(0, parseInt(data.lowStockThreshold, 10) || 10),
      price: Math.max(0, parseFloat(data.price) || 0),
      costPrice: Math.max(0, parseFloat(data.costPrice) || 0),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const doc = new ProductDocument(docData);
    await doc.save();
    return doc;
  }

  static async insertMany(items = []) {
    const created = [];
    for (const item of items) {
      const p = await this.create(item);
      created.push(p);
    }
    return created;
  }

  static async countDocuments() {
    try {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });

      if (!error && typeof count === "number") {
        return count;
      }
    } catch {
      // Fallback
    }
    return memoryStore.size;
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const doc = await this.findById(id);
    if (!doc) return null;
    Object.assign(doc, update);
    await doc.save();
    return doc;
  }

  static async findByIdAndDelete(id) {
    const doc = await this.findById(id);
    if (!doc) return null;

    memoryStore.delete(id);
    if (DB_ENABLED) {
      try {
        await supabase.from("products").delete().eq("id", id);
      } catch {
        // Fallback
      }
    }
    return doc;
  }

  static async deleteMany(filter = {}) {
    if (Object.keys(filter).length === 0) {
      memoryStore.clear();
      if (!DB_ENABLED) return { acknowledged: true };
      try {
        const { error } = await supabase.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) {
          console.warn(`Supabase products delete failed (${error.code || "unknown"}): ${error.message}`);
        }
      } catch {
        // Fallback
      }
    }
    return { acknowledged: true };
  }
}

export default ProductModel;
