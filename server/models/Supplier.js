import { supabase } from "../supabase.js";
import { generateId, Query } from "./storeHelper.js";

let memorySuppliers = new Map();

function supplierToRow(s) {
  return {
    id: s.id || s._id || generateId(),
    name: s.name,
    code: (s.code || "").toUpperCase(),
    contact_person: s.contactPerson || "",
    email: s.email || "",
    phone: s.phone || "",
    gstin: (s.gstin || "").toUpperCase(),
    city: s.city || "Mumbai",
    payment_terms: s.paymentTerms || "Net 30",
    status: s.status || "active",
  };
}

function rowToSupplier(r) {
  return {
    _id: r.id,
    id: r.id,
    name: r.name,
    code: r.code,
    contactPerson: r.contact_person,
    email: r.email,
    phone: r.phone,
    gstin: r.gstin,
    city: r.city,
    paymentTerms: r.payment_terms,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
  };
}

class SupplierModel {
  static find(filter = {}) {
    return new Query(async () => {
      let items = [];

      try {
        const { data, error } = await supabase
          .from("suppliers")
          .select("*")
          .order("name", { ascending: true });

        if (!error && Array.isArray(data)) {
          items = data.map(rowToSupplier);
          items.forEach((s) => memorySuppliers.set(s._id, s));
        } else {
          items = Array.from(memorySuppliers.values());
        }
      } catch {
        items = Array.from(memorySuppliers.values());
      }

      return items;
    });
  }

  static async findOne(filter = {}) {
    const list = await this.find();
    if (filter.code) {
      const target = filter.code.toUpperCase();
      return list.find((s) => s.code?.toUpperCase() === target) || null;
    }
    return list[0] || null;
  }

  static async findById(id) {
    if (!id) return null;
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        return rowToSupplier(data);
      }
    } catch {
      // Fallback
    }
    return memorySuppliers.get(id) || null;
  }

  static async create(data) {
    const code = (data.code || "").trim().toUpperCase();
    const existing = await this.findOne({ code });
    if (existing) {
      const err = new Error("Supplier code already exists");
      err.code = 11000;
      throw err;
    }

    const id = data.id || data._id || generateId();
    const supplier = {
      _id: id,
      id,
      name: data.name.trim(),
      code,
      contactPerson: data.contactPerson?.trim() || "",
      email: data.email?.trim() || "",
      phone: data.phone?.trim() || "",
      gstin: data.gstin?.trim().toUpperCase() || "",
      city: data.city?.trim() || "Mumbai",
      paymentTerms: data.paymentTerms || "Net 30",
      status: data.status || "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memorySuppliers.set(id, supplier);

    try {
      const row = supplierToRow(supplier);
      await supabase.from("suppliers").insert([row]);
    } catch {
      // Fallback
    }

    return supplier;
  }

  static async insertMany(items = []) {
    const created = [];
    for (const item of items) {
      const c = await this.create(item);
      created.push(c);
    }
    return created;
  }

  static async countDocuments() {
    try {
      const { count, error } = await supabase
        .from("suppliers")
        .select("*", { count: "exact", head: true });

      if (!error && typeof count === "number") {
        return count;
      }
    } catch {
      // Fallback
    }
    return memorySuppliers.size;
  }

  static async findByIdAndDelete(id) {
    const s = await this.findById(id);
    if (!s) return null;

    memorySuppliers.delete(id);
    try {
      await supabase.from("suppliers").delete().eq("id", id);
    } catch {
      // Fallback
    }
    return s;
  }

  static async deleteMany(filter = {}) {
    memorySuppliers.clear();
    try {
      await supabase.from("suppliers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    } catch {
      // Fallback
    }
    return { acknowledged: true };
  }
}

export default SupplierModel;
