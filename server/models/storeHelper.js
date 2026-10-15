import crypto from "crypto";

export function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
}

// Map JavaScript Product object to Supabase Postgres row
export function productToRow(doc) {
  const row = {};
  if (doc.id || doc._id) row.id = doc.id || doc._id;
  if (doc.name !== undefined) row.name = doc.name;
  if (doc.sku !== undefined) row.sku = doc.sku;
  if (doc.category !== undefined) row.category = doc.category;
  if (doc.quantity !== undefined) row.quantity = doc.quantity;
  if (doc.lowStockThreshold !== undefined) row.low_stock_threshold = doc.lowStockThreshold;
  if (doc.price !== undefined) row.price = doc.price;
  if (doc.costPrice !== undefined) row.cost_price = doc.costPrice;
  if (doc.warehouse !== undefined) row.warehouse = doc.warehouse;
  if (doc.supplier !== undefined) row.supplier = doc.supplier;
  if (doc.batchNumber !== undefined) row.batch_number = doc.batchNumber;
  if (doc.expiryDate !== undefined) row.expiry_date = doc.expiryDate ? new Date(doc.expiryDate).toISOString() : null;
  if (doc.serialNumber !== undefined) row.serial_number = doc.serialNumber;
  if (doc.barcode !== undefined) row.barcode = doc.barcode;
  if (doc.reorderQuantity !== undefined) row.reorder_quantity = doc.reorderQuantity;
  if (doc.gstRate !== undefined) row.gst_rate = doc.gstRate;
  if (doc.status !== undefined) row.status = doc.status;
  if (doc.variants !== undefined) row.variants = doc.variants;
  return row;
}

// Map Supabase Postgres row to JavaScript Product object
export function rowToProduct(row) {
  if (!row) return null;
  const p = {
    _id: row.id,
    id: row.id,
    name: row.name || "",
    sku: row.sku || "",
    category: row.category || "General",
    quantity: typeof row.quantity === "number" ? row.quantity : 0,
    lowStockThreshold: typeof row.low_stock_threshold === "number" ? row.low_stock_threshold : 10,
    price: typeof row.price === "number" ? row.price : parseFloat(row.price) || 0,
    costPrice: typeof row.cost_price === "number" ? row.cost_price : parseFloat(row.cost_price) || 0,
    warehouse: row.warehouse || "Main Hub (Bengaluru)",
    supplier: row.supplier || "Standard Vendor",
    batchNumber: row.batch_number || "",
    expiryDate: row.expiry_date ? new Date(row.expiry_date) : null,
    serialNumber: row.serial_number || "",
    barcode: row.barcode || "",
    reorderQuantity: typeof row.reorder_quantity === "number" ? row.reorder_quantity : 25,
    gstRate: typeof row.gst_rate === "number" ? row.gst_rate : 18,
    status: row.status || "active",
    variants: Array.isArray(row.variants) ? row.variants : [],
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };

  // Virtual fields
  p.totalValue = p.quantity * p.price;
  p.totalCost = p.quantity * p.costPrice;
  p.profitMargin = p.price > 0 ? Math.round(((p.price - p.costPrice) / p.price) * 1000) / 10 : 0;

  return p;
}

// Thenable Query helper supporting .sort(), .limit(), and await
export class Query {
  constructor(executor) {
    this._executor = executor;
    this._sort = null;
    this._limit = null;
  }

  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  async exec() {
    let result = await this._executor();
    if (!Array.isArray(result)) return result;

    if (this._sort) {
      const [field, direction] = Object.entries(this._sort)[0] || [];
      if (field) {
        const factor = direction === -1 || direction === "desc" ? -1 : 1;
        result = [...result].sort((a, b) => {
          const valA = a[field] ?? "";
          const valB = b[field] ?? "";
          if (typeof valA === "string") return valA.localeCompare(valB) * factor;
          return (valA - valB) * factor;
        });
      }
    }

    if (typeof this._limit === "number") {
      result = result.slice(0, this._limit);
    }

    return result;
  }

  then(onFulfilled, onRejected) {
    return this.exec().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.exec().catch(onRejected);
  }
}
