import { supabase } from "../supabase.js";
import { generateId, Query } from "./storeHelper.js";

let memoryOrders = new Map();

function orderToRow(o) {
  return {
    id: o.id || o._id || generateId(),
    order_number: o.orderNumber,
    type: o.type,
    party_name: o.partyName,
    party_gstin: o.partyGstin || "",
    items: o.items || [],
    subtotal: o.subtotal || 0,
    gst_total: o.gstTotal || 0,
    grand_total: o.grandTotal || 0,
    warehouse: o.warehouse || "Main Hub (Bengaluru)",
    status: o.status || "confirmed",
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
    gstTotal: typeof r.gst_total === "number" ? r.gst_total : parseFloat(r.gst_total) || 0,
    grandTotal: typeof r.grand_total === "number" ? r.grand_total : parseFloat(r.grand_total) || 0,
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

      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data)) {
          items = data.map(rowToOrder);
          items.forEach((o) => memoryOrders.set(o._id, o));
        } else {
          items = Array.from(memoryOrders.values());
        }
      } catch {
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
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        return rowToOrder(data);
      }
    } catch {
      // Fallback
    }
    return memoryOrders.get(id) || null;
  }

  static async create(data) {
    const id = data.id || data._id || generateId();
    const order = {
      _id: id,
      id,
      orderNumber: data.orderNumber,
      type: data.type,
      partyName: data.partyName,
      partyGstin: data.partyGstin || "",
      items: data.items || [],
      subtotal: data.subtotal || 0,
      gstTotal: data.gstTotal || 0,
      grandTotal: data.grandTotal || 0,
      warehouse: data.warehouse || "Main Hub (Bengaluru)",
      status: data.status || "confirmed",
      invoiceNumber: data.invoiceNumber || "",
      notes: data.notes || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryOrders.set(id, order);

    try {
      const row = orderToRow(order);
      await supabase.from("orders").insert([row]);
    } catch {
      // Fallback
    }

    return order;
  }

  static async deleteMany(filter = {}) {
    memoryOrders.clear();
    try {
      await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    } catch {
      // Fallback
    }
    return { acknowledged: true };
  }
}

export default OrderModel;
