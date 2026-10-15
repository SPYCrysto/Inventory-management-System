import React, { useEffect, useState, useMemo } from "react";
import { inventoryApi } from "../api.js";
import { useTheme } from "../theme.jsx";
import { useToast } from "../toast.jsx";
import {
  Card,
  Button,
  Badge,
  Icons,
  Modal,
  Input,
  Select,
  EmptyState,
} from "../ui.jsx";

const ORDER_TYPES = [
  { value: "purchase", label: "Purchase Order (Inward)" },
  { value: "sales", label: "Sales Order (Outward)" },
];

const GST_OPTIONS = [
  { value: "0", label: "0% GST" },
  { value: "5", label: "5% GST" },
  { value: "12", label: "12% GST" },
  { value: "18", label: "18% GST" },
  { value: "28", label: "28% GST" },
];

const EMPTY_ITEM = {
  productId: "",
  productName: "",
  sku: "",
  quantity: 1,
  unitPrice: 0,
  gstRate: 18,
};

export default function Orders() {
  const { formatCurrency } = useTheme();
  const { showToast } = useToast();

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Form state
  const [orderType, setOrderType] = useState("purchase");
  const [partyName, setPartyName] = useState("");
  const [partyGstin, setPartyGstin] = useState("");
  const [warehouse, setWarehouse] = useState("Main Hub (Bengaluru)");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await inventoryApi.getOrders();
      setOrders(data);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await inventoryApi.getProducts();
      setProducts(data);
    } catch {}
  };

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  const filtered = useMemo(() => {
    let result = orders;
    if (filterType !== "all") {
      result = result.filter((o) => o.type === filterType);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(term) ||
          o.partyName.toLowerCase().includes(term) ||
          o.invoiceNumber?.toLowerCase().includes(term)
      );
    }
    return result;
  }, [orders, filterType, search]);

  const orderStats = useMemo(() => {
    const po = orders.filter((o) => o.type === "purchase");
    const so = orders.filter((o) => o.type === "sales");
    return {
      total: orders.length,
      purchaseCount: po.length,
      purchaseValue: po.reduce((s, o) => s + (o.grandTotal || 0), 0),
      salesCount: so.length,
      salesValue: so.reduce((s, o) => s + (o.grandTotal || 0), 0),
    };
  }, [orders]);

  // Item helpers
  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const selectProduct = (index, productId) => {
    const product = products.find((p) => p._id === productId);
    if (!product) return;
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        unitPrice: orderType === "purchase" ? product.costPrice || product.price : product.price,
        gstRate: product.gstRate || 18,
      };
      return updated;
    });
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let gstTotal = 0;
    items.forEach((item) => {
      const base = (parseInt(item.quantity, 10) || 0) * (parseFloat(item.unitPrice) || 0);
      const gst = (base * (parseInt(item.gstRate, 10) || 0)) / 100;
      subtotal += base;
      gstTotal += gst;
    });
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      gstTotal: Math.round(gstTotal * 100) / 100,
      grandTotal: Math.round((subtotal + gstTotal) * 100) / 100,
    };
  }, [items]);

  const resetForm = () => {
    setOrderType("purchase");
    setPartyName("");
    setPartyGstin("");
    setWarehouse("Main Hub (Bengaluru)");
    setNotes("");
    setItems([{ ...EMPTY_ITEM }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!partyName.trim()) {
      showToast("Party name is required", "warning");
      return;
    }
    const validItems = items.filter((i) => i.productName && i.quantity > 0);
    if (validItems.length === 0) {
      showToast("At least one item with a product is required", "warning");
      return;
    }
    try {
      setSaving(true);
      const data = {
        type: orderType,
        partyName: partyName.trim(),
        partyGstin: partyGstin.trim(),
        warehouse,
        notes,
        items: validItems,
      };
      const created = await inventoryApi.createOrder(data);
      showToast(
        `${orderType === "purchase" ? "Purchase Order" : "Sales Order"} ${created.orderNumber} created`,
        "success"
      );
      setModalOpen(false);
      resetForm();
      await fetchOrders();
      await fetchProducts(); // Refresh products for updated stock
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading && orders.length === 0) {
    return (
      <div className="page-loading">
        <span className="spinner large" />
        <p>Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase & Sales Orders</h1>
          <p className="page-subtitle">
            Create and track purchase inward and sales outward orders with GST invoicing
          </p>
        </div>
        <div className="header-actions">
          <Button variant="ghost" icon={Icons.RefreshCw} onClick={fetchOrders} loading={loading}>
            Refresh
          </Button>
          <Button
            variant="primary"
            icon={Icons.Plus}
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
          >
            Create Order
          </Button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="order-stats-strip">
        <div className="order-stat-chip total">
          <Icons.FileText className="chip-icon" />
          <div className="chip-content">
            <span className="chip-label">Total Orders</span>
            <span className="chip-value">{orderStats.total}</span>
          </div>
        </div>
        <div className="order-stat-chip purchase">
          <Icons.ArrowDownLeft className="chip-icon" />
          <div className="chip-content">
            <span className="chip-label">Purchase ({orderStats.purchaseCount})</span>
            <span className="chip-value">{formatCurrency(orderStats.purchaseValue)}</span>
          </div>
        </div>
        <div className="order-stat-chip sales">
          <Icons.ArrowUpRight className="chip-icon" />
          <div className="chip-content">
            <span className="chip-label">Sales ({orderStats.salesCount})</span>
            <span className="chip-value">{formatCurrency(orderStats.salesValue)}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="filter-toolbar">
        <div className="search-box">
          <Icons.Search />
          <input
            type="text"
            placeholder="Search by order number, party name, or invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-chips">
          {["all", "purchase", "sales"].map((t) => (
            <button
              key={t}
              className={`filter-chip ${filterType === t ? "active" : ""}`}
              onClick={() => setFilterType(t)}
            >
              {t === "all" ? "All" : t === "purchase" ? "Purchase" : "Sales"}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <EmptyState
          icon={Icons.FileText}
          title="No orders yet"
          description="Create your first purchase or sales order to start tracking transactions with GST invoicing."
          action={
            <Button variant="primary" icon={Icons.Plus} onClick={() => { resetForm(); setModalOpen(true); }}>
              Create First Order
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Icons.Search}
          title="No matching orders"
          description={`No orders match your current filters. Try adjusting your search.`}
        />
      ) : (
        <div className="order-list">
          {filtered.map((order) => {
            const isPurchase = order.type === "purchase";
            const isExpanded = expandedId === order._id;
            return (
              <Card key={order._id} className={`order-card ${isPurchase ? "purchase" : "sales"}`}>
                <div
                  className="order-card-header"
                  onClick={() => setExpandedId(isExpanded ? null : order._id)}
                >
                  <div className="order-header-left">
                    <div className={`order-type-icon ${isPurchase ? "purchase" : "sales"}`}>
                      {isPurchase ? <Icons.ArrowDownLeft /> : <Icons.ArrowUpRight />}
                    </div>
                    <div className="order-header-info">
                      <div className="order-number-row">
                        <span className="order-number">{order.orderNumber}</span>
                        <Badge variant={isPurchase ? "info" : "warning"} size="sm">
                          {isPurchase ? "Purchase" : "Sales"}
                        </Badge>
                        <Badge
                          variant={
                            order.status === "fulfilled"
                              ? "success"
                              : order.status === "cancelled"
                              ? "danger"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {order.status}
                        </Badge>
                      </div>
                      <div className="order-meta-row">
                        <span className="order-party">
                          <Icons.Users className="inline-icon" />
                          {order.partyName}
                        </span>
                        <span className="order-date">
                          <Icons.Clock className="inline-icon" />
                          {formatDate(order.createdAt)} {formatTime(order.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="order-header-right">
                    <div className="order-total-display">
                      <span className="order-total-label">Grand Total</span>
                      <span className="order-total-value">
                        {formatCurrency(order.grandTotal)}
                      </span>
                    </div>
                    <div className="order-expand-icon">
                      {isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
                    </div>
                  </div>
                </div>

                {/* Expanded Order Details */}
                {isExpanded && (
                  <div className="order-expanded">
                    {/* Invoice & Warehouse Info */}
                    <div className="order-detail-tags">
                      {order.invoiceNumber && (
                        <span className="order-detail-tag">
                          <Icons.FileText className="inline-icon" />
                          Invoice: {order.invoiceNumber}
                        </span>
                      )}
                      <span className="order-detail-tag">
                        <Icons.Truck className="inline-icon" />
                        {order.warehouse}
                      </span>
                      {order.partyGstin && (
                        <span className="order-detail-tag">
                          <Icons.Hash className="inline-icon" />
                          GSTIN: {order.partyGstin}
                        </span>
                      )}
                    </div>

                    {/* Items Table */}
                    <div className="order-items-table-wrap">
                      <table className="order-items-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>SKU</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Unit Price</th>
                            <th className="text-right">GST</th>
                            <th className="text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items?.map((item, idx) => (
                            <tr key={idx}>
                              <td className="item-name">{item.productName}</td>
                              <td className="item-sku">{item.sku}</td>
                              <td className="text-right">{item.quantity}</td>
                              <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                              <td className="text-right">{item.gstRate}%</td>
                              <td className="text-right font-semibold">
                                {formatCurrency(item.itemTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals Summary */}
                    <div className="order-totals">
                      <div className="order-total-row">
                        <span>Subtotal</span>
                        <span>{formatCurrency(order.subtotal)}</span>
                      </div>
                      <div className="order-total-row">
                        <span>GST</span>
                        <span>{formatCurrency(order.gstTotal)}</span>
                      </div>
                      <div className="order-total-row grand">
                        <span>Grand Total</span>
                        <span>{formatCurrency(order.grandTotal)}</span>
                      </div>
                    </div>

                    {order.notes && (
                      <div className="order-notes">
                        <strong>Notes:</strong> {order.notes}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Order Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create New Order"
        maxWidth="720px"
      >
        <form onSubmit={handleSubmit} className="modal-form order-form">
          {/* Order Type Selector */}
          <div className="order-type-selector">
            {ORDER_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`order-type-btn ${orderType === t.value ? "active" : ""} ${t.value}`}
                onClick={() => setOrderType(t.value)}
              >
                {t.value === "purchase" ? (
                  <Icons.ArrowDownLeft className="type-btn-icon" />
                ) : (
                  <Icons.ArrowUpRight className="type-btn-icon" />
                )}
                {t.label}
              </button>
            ))}
          </div>

          {/* Party Details */}
          <div className="form-grid-2">
            <Input
              label="Party Name *"
              placeholder={orderType === "purchase" ? "Supplier name" : "Customer name"}
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              required
            />
            <Input
              label="Party GSTIN"
              placeholder="22AAAAA0000A1Z5"
              value={partyGstin}
              onChange={(e) => setPartyGstin(e.target.value.toUpperCase())}
            />
          </div>

          <div className="form-grid-2">
            <Input
              label="Warehouse"
              placeholder="Main Hub (Bengaluru)"
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
            />
            <Input
              label="Notes"
              placeholder="Optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Line Items */}
          <div className="order-items-section">
            <div className="items-section-header">
              <h4>Line Items</h4>
              <Button variant="ghost" size="sm" type="button" icon={Icons.Plus} onClick={addItem}>
                Add Item
              </Button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="order-item-row">
                <div className="item-product-select">
                  <label className="form-label">Product</label>
                  <select
                    className="form-select"
                    value={item.productId}
                    onChange={(e) => selectProduct(idx, e.target.value)}
                  >
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.sku}) — {p.quantity} in stock
                      </option>
                    ))}
                  </select>
                </div>
                <div className="item-field qty">
                  <label className="form-label">Qty</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                  />
                </div>
                <div className="item-field price">
                  <label className="form-label">Unit Price</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                  />
                </div>
                <div className="item-field gst">
                  <label className="form-label">GST</label>
                  <select
                    className="form-select"
                    value={item.gstRate}
                    onChange={(e) => updateItem(idx, "gstRate", parseInt(e.target.value, 10))}
                  >
                    {GST_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="item-field total-col">
                  <label className="form-label">Total</label>
                  <span className="item-total-value">
                    {formatCurrency(
                      ((parseInt(item.quantity, 10) || 0) * (parseFloat(item.unitPrice) || 0)) *
                        (1 + (parseInt(item.gstRate, 10) || 0) / 100)
                    )}
                  </span>
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="btn-icon-close item-remove"
                    onClick={() => removeItem(idx)}
                    title="Remove item"
                  >
                    <Icons.X />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Totals Preview */}
          <div className="order-form-totals">
            <div className="form-total-row">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="form-total-row">
              <span>GST Amount</span>
              <span>{formatCurrency(totals.gstTotal)}</span>
            </div>
            <div className="form-total-row grand">
              <span>Grand Total</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>

          <div className="modal-actions">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={saving}>
              {orderType === "purchase" ? "Create Purchase Order" : "Create Sales Order"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
