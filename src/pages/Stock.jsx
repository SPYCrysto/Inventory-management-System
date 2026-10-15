import React, { useEffect, useState, useMemo } from "react";
import { inventoryApi } from "../api.js";
import { useTheme } from "../theme.jsx";
import { useToast } from "../toast.jsx";
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Icons,
  EmptyState,
} from "../ui.jsx";

export default function Stock() {
  const { showToast } = useToast();

  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterType, setFilterType] = useState("all"); // 'all', 'in', 'out'
  const [timeFilter, setTimeFilter] = useState("all"); // 'all', 'today', '7days', '30days'
  const [search, setSearch] = useState("");

  // Quick Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [deltaAmount, setDeltaAmount] = useState(10);
  const [actionType, setActionType] = useState("in"); // 'in' or 'out'
  const [reason, setReason] = useState("Warehouse Inflow");
  const [submitting, setSubmitting] = useState(false);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      setError("");
      const [movData, prodData] = await Promise.all([
        inventoryApi.getMovements(150),
        inventoryApi.getProducts(),
      ]);
      setMovements(movData);
      setProducts(prodData);
      if (prodData.length > 0 && !selectedProductId) {
        setSelectedProductId(prodData[0]._id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId) return;

    try {
      setSubmitting(true);
      const absDelta = Math.abs(parseInt(deltaAmount, 10) || 0);
      const delta = actionType === "out" ? -absDelta : absDelta;

      const res = await inventoryApi.adjustStock(selectedProductId, {
        delta,
        reason,
      });

      setAdjustModalOpen(false);
      showToast(
        `Recorded movement: ${delta > 0 ? "+" : ""}${delta} units (${reason})`,
        "success"
      );
      await fetchMovements();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // CSV Export for Movements
  const handleExportMovementsCSV = () => {
    if (filteredMovements.length === 0) return;

    const headers = [
      "Timestamp",
      "Product Name",
      "SKU",
      "Delta",
      "Reason",
      "Running Balance",
    ];
    const rows = filteredMovements.map((m) => [
      `"${new Date(m.createdAt).toISOString()}"`,
      `"${m.productName.replace(/"/g, '""')}"`,
      `"${m.sku}"`,
      m.delta,
      `"${m.reason.replace(/"/g, '""')}"`,
      m.runningBalance,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `inventra-stock-audit-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filteredMovements.length} movements to CSV`, "success");
  };

  const filteredMovements = useMemo(() => {
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    return movements.filter((m) => {
      // Type filter
      if (filterType === "in" && m.delta <= 0) return false;
      if (filterType === "out" && m.delta >= 0) return false;

      // Time filter
      if (timeFilter !== "all") {
        const itemDate = new Date(m.createdAt);
        const diffMs = now - itemDate;

        if (timeFilter === "today" && diffMs > oneDay) return false;
        if (timeFilter === "7days" && diffMs > 7 * oneDay) return false;
        if (timeFilter === "30days" && diffMs > 30 * oneDay) return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchProduct = m.productName?.toLowerCase().includes(q);
        const matchSku = m.sku?.toLowerCase().includes(q);
        const matchReason = m.reason?.toLowerCase().includes(q);
        if (!matchProduct && !matchSku && !matchReason) return false;
      }

      return true;
    });
  }, [movements, filterType, timeFilter, search]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock History & Audit Log</h1>
          <p className="page-subtitle">
            Every inventory change is permanently logged with reason, delta, and running balance
          </p>
        </div>
        <div className="header-actions">
          <Button
            variant="secondary"
            icon={Icons.Download}
            onClick={handleExportMovementsCSV}
            disabled={filteredMovements.length === 0}
          >
            Export Log CSV
          </Button>
          <Button
            variant="primary"
            icon={Icons.Plus}
            onClick={() => setAdjustModalOpen(true)}
            disabled={products.length === 0}
          >
            Record Adjustment
          </Button>
        </div>
      </div>

      {error && (
        <div className="alert-banner error">
          <Icons.AlertTriangle />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchMovements}>
            Retry
          </Button>
        </div>
      )}

      {/* Toolbar / Filters */}
      <Card className="toolbar-card">
        <div className="toolbar-row">
          <div className="search-box">
            <Icons.Search className="search-icon" />
            <input
              type="text"
              placeholder="Search by product name, SKU, or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch("")}>
                <Icons.X />
              </button>
            )}
          </div>

          <div className="toolbar-filters">
            {/* Time Filter Pills */}
            <select
              className="toolbar-select"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today Only</option>
              <option value="7days">Past 7 Days</option>
              <option value="30days">Past 30 Days</option>
            </select>

            <div className="filter-pills">
              <button
                className={`filter-pill ${filterType === "all" ? "active" : ""}`}
                onClick={() => setFilterType("all")}
              >
                All
              </button>
              <button
                className={`filter-pill pos ${
                  filterType === "in" ? "active" : ""
                }`}
                onClick={() => setFilterType("in")}
              >
                <Icons.ArrowDownLeft /> In
              </button>
              <button
                className={`filter-pill neg ${
                  filterType === "out" ? "active" : ""
                }`}
                onClick={() => setFilterType("out")}
              >
                <Icons.ArrowUpRight /> Out
              </button>
            </div>
          </div>
        </div>

        <div className="toolbar-meta">
          <span className="results-counter">
            Showing <strong>{filteredMovements.length}</strong> of{" "}
            <strong>{movements.length}</strong> logged movements
          </span>
          {(search || filterType !== "all" || timeFilter !== "all") && (
            <button
              className="clear-all-link"
              onClick={() => {
                setSearch("");
                setFilterType("all");
                setTimeFilter("all");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* Log Table */}
      {loading && movements.length === 0 ? (
        <div className="page-loading">
          <span className="spinner large" />
          <p>Fetching stock movements...</p>
        </div>
      ) : filteredMovements.length === 0 ? (
        <Card className="empty-panel">
          <EmptyState
            icon={Icons.ArrowUpDown}
            title="No Movements Recorded"
            description={
              movements.length === 0
                ? "Perform your first stock adjustment or create products to begin the audit trail."
                : "No movements match your current search or time filter."
            }
            action={
              products.length > 0 && (
                <Button
                  variant="primary"
                  icon={Icons.Plus}
                  onClick={() => setAdjustModalOpen(true)}
                >
                  Record Adjustment
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Reason</th>
                  <th style={{ textAlign: "right" }}>Delta Change</th>
                  <th style={{ textAlign: "right" }}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m) => {
                  const isPos = m.delta > 0;
                  const dateStr = new Date(m.createdAt).toLocaleString(
                    undefined,
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  );

                  return (
                    <tr key={m._id}>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.85rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {dateStr}
                      </td>
                      <td>
                        <strong>{m.productName}</strong>
                      </td>
                      <td>
                        <code className="sku-badge">{m.sku}</code>
                      </td>
                      <td>
                        <span className="reason-pill">{m.reason}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className={`delta-badge ${
                            isPos ? "delta-pos" : "delta-neg"
                          }`}
                        >
                          {isPos ? `+${m.delta}` : m.delta}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {m.runningBalance} units
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* RECORD ADJUSTMENT MODAL */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Record Stock Adjustment"
      >
        <form onSubmit={handleAdjustSubmit}>
          <div className="form-group">
            <label className="form-label">Select Product</label>
            <select
              className="form-select"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              required
            >
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.sku}) — Current: {p.quantity} units
                </option>
              ))}
            </select>
          </div>

          <div className="action-toggle-row">
            <button
              type="button"
              className={`toggle-btn in ${actionType === "in" ? "active" : ""}`}
              onClick={() => {
                setActionType("in");
                setReason("Supplier Restock");
              }}
            >
              <Icons.ArrowDownLeft /> Stock In (Add)
            </button>
            <button
              type="button"
              className={`toggle-btn out ${actionType === "out" ? "active" : ""}`}
              onClick={() => {
                setActionType("out");
                setReason("Customer Sale");
              }}
            >
              <Icons.ArrowUpRight /> Stock Out (Remove)
            </button>
          </div>

          <Input
            label="Quantity Units"
            type="number"
            min="1"
            value={deltaAmount}
            onChange={(e) =>
              setDeltaAmount(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            required
          />

          <Input
            label="Reason"
            placeholder="e.g. Purchase Order, Customer Order, Return, Shrinkage"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />

          <div className="modal-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAdjustModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={actionType === "in" ? "primary" : "danger"}
              loading={submitting}
            >
              Apply {actionType === "in" ? "Stock In" : "Stock Out"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
