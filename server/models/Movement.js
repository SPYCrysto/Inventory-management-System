import { supabase, DB_ENABLED } from "../supabase.js";
import { generateId, Query } from "./storeHelper.js";

let memoryMovements = [];

const DEFAULT_MOVEMENTS = [
  {
    _id: "mov-01",
    id: "mov-01",
    productId: "prod-kb-01",
    productName: "Ergonomic Mechanical Keyboard",
    sku: "KB-MECH-01",
    delta: 28,
    reason: "Initial Stock Receipt (PO-2026-001)",
    runningBalance: 28,
    createdAt: new Date(Date.now() - 3600000 * 2),
  },
  {
    _id: "mov-02",
    id: "mov-02",
    productId: "prod-aud-02",
    productName: "Wireless Noise-Canceling Headphones",
    sku: "AUD-HDPH-02",
    delta: -4,
    reason: "B2B Sales Dispatch (INV-8821)",
    runningBalance: 6,
    createdAt: new Date(Date.now() - 3600000 * 5),
  },
  {
    _id: "mov-03",
    id: "mov-03",
    productId: "prod-mon-04",
    productName: "Ultra-Wide 4K IPS Monitor 34-Inch",
    sku: "MON-4K-04",
    delta: 15,
    reason: "Supplier Inbound Docking (PO-2026-004)",
    runningBalance: 15,
    createdAt: new Date(Date.now() - 3600000 * 8),
  },
  {
    _id: "mov-04",
    id: "mov-04",
    productId: "prod-mse-05",
    productName: "Precision Ergonomic Vertical Mouse",
    sku: "MSE-VERT-05",
    delta: -8,
    reason: "Fulfillment Batch #441",
    runningBalance: 42,
    createdAt: new Date(Date.now() - 3600000 * 12),
  },
  {
    _id: "mov-05",
    id: "mov-05",
    productId: "prod-dock-03",
    productName: "USB-C Ultra Docking Station 10-in-1",
    sku: "ACC-DOCK-03",
    delta: -6,
    reason: "Direct Order Dispatch",
    runningBalance: 4,
    createdAt: new Date(Date.now() - 3600000 * 16),
  },
];

if (process.env.NODE_ENV !== "test") {
  memoryMovements = [...DEFAULT_MOVEMENTS];
}

function movementToRow(m) {
  return {
    id: m.id || m._id || generateId(),
    product_id: m.productId ? m.productId.toString() : null,
    product_name: m.productName || "",
    sku: (m.sku || "").toUpperCase(),
    delta: typeof m.delta === "number" ? m.delta : parseInt(m.delta, 10) || 0,
    reason: m.reason || "Manual Adjustment",
    running_balance: typeof m.runningBalance === "number" ? m.runningBalance : 0,
  };
}

function rowToMovement(r) {
  return {
    _id: r.id,
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    sku: r.sku,
    delta: r.delta,
    reason: r.reason,
    runningBalance: r.running_balance,
    createdAt: r.created_at ? new Date(r.created_at) : new Date(),
  };
}

class MovementModel {
  static find(filter = {}) {
    return new Query(async () => {
      let items = [];

      if (DB_ENABLED) {
        try {
          const { data, error } = await supabase
            .from("movements")
            .select("*")
            .order("created_at", { ascending: false });

          if (!error && Array.isArray(data)) {
            if (data.length > 0) {
              items = data.map(rowToMovement);
              memoryMovements = [...items];
            } else if (memoryMovements.length > 0) {
              items = [...memoryMovements];
              if (process.env.NODE_ENV !== "test") {
                const rows = items.map(movementToRow);
                supabase.from("movements").upsert(rows, { onConflict: "id" }).then(() => {}).catch(() => {});
              }
            }
          } else {
            items = [...memoryMovements];
          }
        } catch {
          items = [...memoryMovements];
        }
      } else {
        items = [...memoryMovements];
      }

      if (filter.productId) {
        items = items.filter((m) => m.productId === filter.productId || m.productId === filter.productId?.toString());
      }
      if (filter.sku) {
        items = items.filter((m) => m.sku === filter.sku);
      }
      if (filter.delta) {
        if (typeof filter.delta === "object") {
          if (filter.delta.$gt !== undefined) items = items.filter((m) => m.delta > filter.delta.$gt);
          if (filter.delta.$lt !== undefined) items = items.filter((m) => m.delta < filter.delta.$lt);
        } else {
          items = items.filter((m) => m.delta === filter.delta);
        }
      }

      return items;
    });
  }

  static async findOne(filter = {}) {
    const list = await this.find(filter);
    return list[0] || null;
  }

  static async create(data) {
    const id = data.id || data._id || generateId();
    const item = {
      _id: id,
      id,
      productId: data.productId ? data.productId.toString() : null,
      productName: data.productName,
      sku: (data.sku || "").toUpperCase(),
      delta: data.delta,
      reason: data.reason || "Manual Adjustment",
      runningBalance: data.runningBalance,
      createdAt: new Date(),
    };

    memoryMovements.unshift(item);

    if (!DB_ENABLED) return item;

    try {
      const row = movementToRow(item);
      const { error } = await supabase.from("movements").insert([row]);
      if (error) {
        console.warn(`Supabase movements write failed (${error.code || "unknown"}): ${error.message}`);
      }
    } catch {
      // Supabase table fallback
    }

    return item;
  }

  static async insertMany(items = []) {
    const created = [];
    for (const item of items) {
      const c = await this.create(item);
      created.push(c);
    }
    return created;
  }

  static async deleteMany(filter = {}) {
    if (filter.productId) {
      const pIdStr = filter.productId.toString();
      memoryMovements = memoryMovements.filter((m) => m.productId !== pIdStr);
      if (!DB_ENABLED) return { acknowledged: true };
      try {
        const { error } = await supabase.from("movements").delete().eq("product_id", pIdStr);
        if (error) {
          console.warn(`Supabase movements delete failed (${error.code || "unknown"}): ${error.message}`);
        }
      } catch {
        // Fallback
      }
    } else {
      memoryMovements = [];
      if (!DB_ENABLED) return { acknowledged: true };
      try {
        const { error } = await supabase.from("movements").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) {
          console.warn(`Supabase movements delete failed (${error.code || "unknown"}): ${error.message}`);
        }
      } catch {
        // Fallback
      }
    }
    return { acknowledged: true };
  }
}

export default MovementModel;
