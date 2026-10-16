import { supabase, DB_ENABLED } from "../supabase.js";
import { generateId, Query } from "./storeHelper.js";

let memoryOrders = new Map();

const ORDERS_TABLE = "purchase_orders";

function warnDbError(context, error) {
  if (error) {
    console.warn(`Supabase orders ${context} failed (${error.code || "unknown"}): ${error.message}`);
  }
}

function orderToRow(o) {
  return {
    id: o.id || o._id || generateId(),
    order_number: o.orderNumber,
    type: o.type === "sales" ? "sales" : "purchase",
    party_name: o.partyName,
    party_gstin: o.partyGstin || "",
    items: o.items || [],
    subtotal: o.subtotal || 0,
    tax_amount: o.gstTotal || 0,
    total_amount: o.grandTotal || 0,
    warehouse: o.warehouse || "Main Hub (Bengaluru)",
    status: o.status || "draft",
    invoice_number: o.invoiceNumber || "",
    notes: o.notes || "",
  };
}

function rowToOrder(r) {
  return {
    _id: r.id,
    id: r.id,
    orderNumber: r.order_number,
    type: r.type,
    partyName: r.party_name,
    partyGstin: r.party_gstin,
    items: Array.isArray(r.items) ? r.items : [],
    subtotal: typeof r.subtotal === "number" ? r.subtotal : parseFloat(r.subtotal) || 0,
    gstTotal: typeof r.tax_amount === "number" ? r.tax_amount : parseFloat(r.tax_amount) || 0,
    grandTotal: typeof r.total_amount === "number" ? r.total_amount : parseFloat(r.total_amount) || 0,
    warehouse: r.warehouse,
    status: r.status,
    invoiceNumber: r.invoice_number,
    notes: r.notes,
    createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
  };
}

class OrderModel {
  static find(filter = {}) {
    return new Query(async () => {
      let items = [];

      if (DB_ENABLED) {
        try {
          const { data, error } = await supabase
            .from(ORDERS_TABLE)
            .select("*")
            .order("created_at", { ascending: false });

          if (error) {
            warnDbError("read", error);
            items = Array.from(memoryOrders.values());
          } else if (Array.isArray(data)) {
            items = data.map(rowToOrder);
            items.forEach((o) => memoryOrders.set(o._id, o));
          } else {
            items = Array.from(memoryOrders.values());
          }
        } catch {
          items = Array.from(memoryOrders.values());
        }
      } else {
        items = Array.from(memoryOrders.values());
      }

      if (filter.type) {
        items = items.filter((o) => o.type === filter.type);
      }
      if (filter.status) {
        items = items.filter((o) => o.status === filter.status);
      }

      return items;
    });
  }

  static async findOne(filter = {}) {
    const list = await this.find(filter);
    return list[0] || null;
  }

  static async findById(id) {
    if (!id) return null;
    if (DB_ENABLED) {
      try {
        const { data, error } = await supabase
          .from(ORDERS_TABLE)
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) {
          warnDbError("read", error);
        } else if (data) {
          return rowToOrder(data);
        }
      } catch {
        // Fallback
      }
    }
    return memoryOrders.get(id) || null;
  }

  static async create(data) {
    const id = data.id || data._id || generateId();
    const order = {
      _id: id,
      id,
      orderNumber: data.orderNumber,
      type: data.type === "sales" ? "sales" : "purchase",
      partyName: data.partyName,
      partyGstin: data.partyGstin || "",
      items: data.items || [],
      subtotal: data.subtotal || 0,
      gstTotal: data.gstTotal || 0,
      grandTotal: data.grandTotal || 0,
      warehouse: data.warehouse || "Main Hub (Bengaluru)",
      status: data.status || "draft",
      invoiceNumber: data.invoiceNumber || "",
      notes: data.notes || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryOrders.set(id, order);

    if (!DB_ENABLED) return order;

    try {
      const row = orderToRow(order);
      const { error } = await supabase.from(ORDERS_TABLE).insert([row]);
      warnDbError("write", error);
    } catch {
      // Fallback
    }

    return order;
  }

  static async deleteMany(filter = {}) {
    memoryOrders.clear();
    if (!DB_ENABLED) return { acknowledged: true };
    try {
      const { error } = await supabase.from(ORDERS_TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      warnDbError("delete", error);
    } catch {
      // Fallback
    }
    return { acknowledged: true };
  }
}

export default OrderModel;
