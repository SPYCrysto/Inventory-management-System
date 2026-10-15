import React, { useState, useEffect } from "react";
import { inventoryApi } from "../api.js";
import { useToast } from "../toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  Card,
  Button,
  Badge,
  Icons,
  Input,
  Select,
} from "../ui.jsx";

export default function StockOperations() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Operation form state
  const [operationType, setOperationType] = useState("in"); // 'in' | 'out' | 'adjust' | 'return' | 'damaged'
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [warehouse, setWarehouse] = useState("Main Hub (Bengaluru)");
  const [referenceId, setReferenceId] = useState("");
  const [recentOperations, setRecentOperations] = useState([]);

  useEffect(() => {
    loadProducts();
    loadRecentOperations();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await inventoryApi.getProducts();
      setProducts(data);
      if (data.length > 0 && !selectedProductId) {
        setSelectedProductId(data[0]._id || data[0].id);
      }
    } catch (err) {
      toast(err.message || "Failed to load products", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadRecentOperations = async () => {
    try {
      const data = await inventoryApi.getMovements(10);
      setRecentOperations(data);
    } catch {
      // Ignore
    }
  };

  const selectedProduct = products.find((p) => (p._id || p.id) === selectedProductId);

  // Compute preview delta and new quantity
  const parsedQty = parseInt(quantity, 10) || 0;
  let computedDelta = 0;
  if (operationType === "in" || operationType === "return") {
    computedDelta = parsedQty;
  } else if (operationType === "out" || operationType === "damaged") {
    computedDelta = -parsedQty;
  } else if (operationType === "adjust") {
    // For manual adjustment, user enters target count or delta
    computedDelta = parsedQty - (selectedProduct?.quantity || 0);
  }

  const projectedBalance = (selectedProduct?.quantity || 0) + computedDelta;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast("Please select a valid product", "error");
      return;
    }
    if (parsedQty <= 0 && operationType !== "adjust") {
      toast("Please enter a positive quantity", "error");
      return;
    }
    if (operationType === "adjust" && !reason.trim()) {
      toast("A mandatory reason is required for stock adjustments", "error");
      return;
    }
    if (projectedBalance < 0) {
      toast(`Cannot reduce stock below zero. Current stock is ${selectedProduct.quantity}`, "error");
      return;
    }

    try {
      setSubmitting(true);
      const opLabels = {
        in: "Stock Receipt (Inward)",
        out: "Stock Dispatch (Outward)",
        adjust: `Inventory Audit Correction: ${reason.trim()}`,
        return: `Customer / Supplier Return: ${reason || "Verified Return"}`,
        damaged: `Damaged Stock Quarantine: ${reason || "Inspection Fail"}`,
      };

      const finalReason = referenceId
        ? `${opLabels[operationType]} [Ref: ${referenceId}]`
        : opLabels[operationType];

      const res = await inventoryApi.adjustStock(
        selectedProduct._id || selectedProduct.id,
        computedDelta,
        finalReason
      );

      toast(
        `Successfully updated ${selectedProduct.name}! New stock: ${res.product?.quantity || projectedBalance}`,
        "success"
      );

      setQuantity("");
      setReason("");
      setReferenceId("");
      await loadProducts();
      await loadRecentOperations();
    } catch (err) {
      toast(err.message || "Failed to execute stock operation", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Operations Centre</h1>
          <p className="page-subtitle">
            Perform stock-in, dispatch, warehouse transfers, damaged stock write-offs, and atomic audit reconciliations
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px" }}>
        {/* Main Operation Form */}
        <Card title="Execute Inventory Movement">
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Operation Type Switcher */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 600 }}>
                Operation Type
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
                {[
                  { id: "in", label: "Stock In", color: "var(--accent-primary)" },
                  { id: "out", label: "Stock Out", color: "#f59e0b" },
                  { id: "adjust", label: "Reconciliation", color: "#8b5cf6" },
                  { id: "return", label: "Return", color: "#10b981" },
                  { id: "damaged", label: "Damaged", color: "#ef4444" },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setOperationType(type.id)}
                    style={{
                      padding: "10px 8px",
                      borderRadius: "8px",
                      border: operationType === type.id ? `2px solid ${type.color}` : "1px solid var(--border-color)",
                      background: operationType === type.id ? "var(--bg-input)" : "transparent",
                      color: operationType === type.id ? "var(--text-primary)" : "var(--text-secondary)",
                      fontWeight: operationType === type.id ? 600 : 400,
                      cursor: "pointer",
                      fontSize: "12px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Selector */}
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
                Select Product *
              </label>
              <Select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={loading}
              >
                {products.map((p) => (
                  <option key={p._id || p.id} value={p._id || p.id}>
                    {p.name} ({p.sku}) — Current Stock: {p.quantity} {p.unit || "pcs"}
                  </option>
                ))}
              </Select>
            </div>

            {/* Warehouse Selector */}
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
                Warehouse Location
              </label>
              <Select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
                <option value="Main Hub (Bengaluru)">Main Hub (Bengaluru)</option>
                <option value="North Warehouse (Delhi)">North Warehouse (Delhi)</option>
                <option value="West Hub (Mumbai)">West Hub (Mumbai)</option>
                <option value="South Facility (Chennai)">South Facility (Chennai)</option>
              </Select>
            </div>

            {/* Quantity Input */}
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
                {operationType === "adjust" ? "New Target Balance (Total Quantity) *" : "Quantity to Transfer *"}
              </label>
              <Input
                type="number"
                min="0"
                required
                placeholder={operationType === "adjust" ? "Enter exact new physical count" : "e.g. 10"}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            {/* Mandatory Reason */}
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
                Reason / Justification {operationType === "adjust" ? "(Mandatory for Audits) *" : ""}
              </label>
              <Input
                required={operationType === "adjust"}
                placeholder="e.g. Supplier PO receipt, physical stocktake variance, box damage..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Reference Document ID */}
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
                Reference Document # (Optional PO/Invoice/Challan)
              </label>
              <Input
                placeholder="e.g. PO-2026-9042, INV-00812"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
              />
            </div>

            {/* Live Atomic Impact Preview Box */}
            {selectedProduct && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: projectedBalance < 0 ? "rgba(239, 68, 68, 0.1)" : "var(--bg-input)",
                  border: projectedBalance < 0 ? "1px solid #ef4444" : "1px solid var(--border-color)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block" }}>
                      Current Available
                    </span>
                    <span style={{ fontSize: "16px", fontWeight: 600 }}>{selectedProduct.quantity} units</span>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block" }}>
                      Delta Adjustment
                    </span>
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: computedDelta > 0 ? "#10b981" : computedDelta < 0 ? "#ef4444" : "var(--text-primary)",
                      }}
                    >
                      {computedDelta > 0 ? `+${computedDelta}` : computedDelta}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block" }}>
                      Projected Balance
                    </span>
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: projectedBalance < 0 ? "#ef4444" : "var(--accent-primary)",
                      }}
                    >
                      {projectedBalance} units
                    </span>
                  </div>
                </div>
                {projectedBalance < 0 && (
                  <p style={{ color: "#ef4444", fontSize: "12px", margin: "10px 0 0 0", fontWeight: 500 }}>
                    ⚠️ Transaction blocked: Inventory cannot be reduced below zero.
                  </p>
                )}
              </div>
            )}

            <Button
              variant="primary"
              type="submit"
              size="lg"
              disabled={submitting || !selectedProduct || projectedBalance < 0}
              icon={Icons.ArrowUpDown}
            >
              {submitting ? "Committing Transaction..." : "Confirm & Commit Stock Movement"}
            </Button>
          </form>
        </Card>

        {/* Audit Log Stream */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <Card title="Recent Movements Stream">
            {recentOperations.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>No recent movements logged.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {recentOperations.slice(0, 7).map((m) => (
                  <div
                    key={m._id || m.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{m.productName}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        {m.reason}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Badge variant={m.delta > 0 ? "success" : "danger"}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </Badge>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                        Bal: {m.runningBalance}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Compliance Guidelines">
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <li>Every movement creates an immutable ledger entry in Supabase.</li>
              <li>Negative quantities are strictly prevented at both the application and database level.</li>
              <li>Audits and stocktakes must specify the counting physical team and reason.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
