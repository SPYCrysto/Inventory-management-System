import React, { useState, useEffect, useMemo } from "react";
import { inventoryApi } from "../api.js";
import { useToast } from "../toast.jsx";
import {
  Card,
  Button,
  Badge,
  Icons,
  Select,
} from "../ui.jsx";

export default function Reports() {
  const { toast } = useToast();
  const [reportType, setReportType] = useState("valuation");
  // 'valuation' | 'low_stock' | 'out_of_stock' | 'movements' | 'orders' | 'audit'

  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState("all"); // 'all' | 'today' | '7days' | '30days'
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [pData, mData, oData] = await Promise.allSettled([
        inventoryApi.getProducts(),
        inventoryApi.getMovements(200),
        inventoryApi.getOrders ? inventoryApi.getOrders() : Promise.resolve([]),
      ]);

      if (pData.status === "fulfilled") setProducts(pData.value);
      if (mData.status === "fulfilled") setMovements(mData.value);
      if (oData.status === "fulfilled") setOrders(oData.value);
    } catch (err) {
      toast(err.message || "Failed to load report data", "error");
    } finally {
      setLoading(false);
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || "General"));
    return ["all", ...Array.from(set)];
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (categoryFilter !== "all") {
      result = result.filter((p) => (p.category || "General") === categoryFilter);
    }
    if (reportType === "low_stock") {
      result = result.filter((p) => p.quantity > 0 && p.quantity <= (p.lowStockThreshold || p.min_stock_threshold || 10));
    } else if (reportType === "out_of_stock") {
      result = result.filter((p) => (p.quantity || 0) <= 0);
    }
    return result;
  }, [products, categoryFilter, reportType]);

  // Valuation summary stats
  const valuationStats = useMemo(() => {
    let totalItems = 0;
    let totalCostValuation = 0;
    let totalSellingValuation = 0;

    filteredProducts.forEach((p) => {
      const q = p.quantity || 0;
      totalItems += q;
      totalCostValuation += q * (p.costPrice || p.purchase_price || 0);
      totalSellingValuation += q * (p.price || p.selling_price || 0);
    });

    const projectedProfit = totalSellingValuation - totalCostValuation;
    const margin = totalSellingValuation > 0 ? (projectedProfit / totalSellingValuation) * 100 : 0;

    return {
      totalItems,
      totalCostValuation,
      totalSellingValuation,
      projectedProfit,
      margin: Math.round(margin * 10) / 10,
    };
  }, [filteredProducts]);

  // CSV Export utility
  const handleExportCSV = () => {
    let csvRows = [];

    if (["valuation", "low_stock", "out_of_stock"].includes(reportType)) {
      csvRows.push([
        "Product Name",
        "SKU",
        "Category",
        "Quantity",
        "Threshold",
        "Cost Price ($)",
        "Selling Price ($)",
        "Total Cost Value ($)",
        "Total Retail Value ($)",
        "Status",
      ]);

      filteredProducts.forEach((p) => {
        const q = p.quantity || 0;
        const cp = p.costPrice || p.purchase_price || 0;
        const sp = p.price || p.selling_price || 0;
        csvRows.push([
          `"${p.name.replace(/"/g, '""')}"`,
          p.sku,
          p.category,
          q,
          p.lowStockThreshold || 10,
          cp.toFixed(2),
          sp.toFixed(2),
          (q * cp).toFixed(2),
          (q * sp).toFixed(2),
          p.status || "active",
        ]);
      });
    } else if (reportType === "movements" || reportType === "audit") {
      csvRows.push(["Timestamp", "Product Name", "SKU", "Delta", "Running Balance", "Reason"]);
      movements.forEach((m) => {
        csvRows.push([
          new Date(m.createdAt).toISOString(),
          `"${m.productName.replace(/"/g, '""')}"`,
          m.sku,
          m.delta,
          m.runningBalance,
          `"${(m.reason || "").replace(/"/g, '""')}"`,
        ]);
      });
    } else if (reportType === "orders") {
      csvRows.push(["Order Number", "Type", "Party Name", "Date", "Items Count", "Total ($)", "Status"]);
      orders.forEach((o) => {
        csvRows.push([
          o.orderNumber,
          o.type,
          `"${(o.partyName || "").replace(/"/g, '""')}"`,
          new Date(o.createdAt).toLocaleDateString(),
          o.items?.length || 0,
          (o.grandTotal || 0).toFixed(2),
          o.status,
        ]);
      });
    }

    const csvString = "data:text/csv;charset=utf-8," + csvRows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvString);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventra_${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("CSV exported successfully", "success");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Reports & Valuation</h1>
          <p className="page-subtitle">
            Generate audit-ready valuation, stock movements, and low-inventory compliance summaries
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Button variant="outline" icon={Icons.Printer} onClick={handlePrint}>
            Print Report
          </Button>
          <Button variant="primary" icon={Icons.Download} onClick={handleExportCSV}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "16px" }}>
        {[
          { id: "valuation", label: "Inventory Valuation", icon: Icons.DollarSign },
          { id: "low_stock", label: "Low Stock Alert", icon: Icons.AlertTriangle },
          { id: "out_of_stock", label: "Out of Stock", icon: Icons.Box },
          { id: "movements", label: "Stock Movement Audit", icon: Icons.ArrowUpDown },
          { id: "orders", label: "Purchase Orders Report", icon: Icons.Receipt },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={reportType === tab.id ? "primary" : "ghost"}
            icon={tab.icon}
            onClick={() => setReportType(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Summary KPI Strip for Valuation */}
      {["valuation", "low_stock", "out_of_stock"].includes(reportType) && (
        <div className="stats-grid" style={{ marginBottom: "20px" }}>
          <Card className="stat-card">
            <span className="stat-label">Total Stock Units</span>
            <span className="stat-value">{valuationStats.totalItems.toLocaleString()}</span>
          </Card>
          <Card className="stat-card">
            <span className="stat-label">Total Asset Cost (FIFO)</span>
            <span className="stat-value">
              ${valuationStats.totalCostValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </Card>
          <Card className="stat-card">
            <span className="stat-label">Total Retail Valuation</span>
            <span className="stat-value" style={{ color: "var(--accent-primary)" }}>
              ${valuationStats.totalSellingValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </Card>
          <Card className="stat-card">
            <span className="stat-label">Projected Gross Margin</span>
            <span className="stat-value" style={{ color: "#10b981" }}>
              {valuationStats.margin}%
            </span>
          </Card>
        </div>
      )}

      {/* Filter Toolbar */}
      <Card style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Category
            </label>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All Categories" : c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Date Range
            </label>
            <Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              <option value="all">All-Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </Select>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Report generated: <strong>{new Date().toLocaleDateString()}</strong> (Supabase Cloud)
            </span>
          </div>
        </div>
      </Card>

      {/* Report Data Table */}
      <Card>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>
            Computing financial statements from Supabase...
          </div>
        ) : (
          <div className="table-responsive">
            {["valuation", "low_stock", "out_of_stock"].includes(reportType) && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Quantity</th>
                    <th style={{ textAlign: "right" }}>Cost Price</th>
                    <th style={{ textAlign: "right" }}>Selling Price</th>
                    <th style={{ textAlign: "right" }}>Total Cost</th>
                    <th style={{ textAlign: "right" }}>Total Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const q = p.quantity || 0;
                    const cp = p.costPrice || p.purchase_price || 0;
                    const sp = p.price || p.selling_price || 0;
                    return (
                      <tr key={p._id || p.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td><code>{p.sku}</code></td>
                        <td><Badge variant="neutral">{p.category}</Badge></td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{q}</td>
                        <td style={{ textAlign: "right" }}>${cp.toFixed(2)}</td>
                        <td style={{ textAlign: "right" }}>${sp.toFixed(2)}</td>
                        <td style={{ textAlign: "right" }}>${(q * cp).toFixed(2)}</td>
                        <td style={{ textAlign: "right", color: "var(--accent-primary)", fontWeight: 600 }}>
                          ${(q * sp).toFixed(2)}
                        </td>
                        <td>
                          <Badge variant={q <= 0 ? "danger" : q <= (p.lowStockThreshold || 10) ? "warning" : "success"}>
                            {q <= 0 ? "Out of Stock" : q <= (p.lowStockThreshold || 10) ? "Low Stock" : "In Stock"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {reportType === "movements" && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign: "right" }}>Change (Delta)</th>
                    <th style={{ textAlign: "right" }}>Running Balance</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m._id || m.id}>
                      <td>{new Date(m.createdAt).toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{m.productName}</td>
                      <td><code>{m.sku}</code></td>
                      <td style={{ textAlign: "right" }}>
                        <Badge variant={m.delta > 0 ? "success" : "danger"}>
                          {m.delta > 0 ? `+${m.delta}` : m.delta}
                        </Badge>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{m.runningBalance}</td>
                      <td>{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === "orders" && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Type</th>
                    <th>Party Name</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Items</th>
                    <th style={{ textAlign: "right" }}>Subtotal</th>
                    <th style={{ textAlign: "right" }}>Grand Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id || o.id}>
                      <td style={{ fontWeight: 600 }}><code>{o.orderNumber}</code></td>
                      <td>
                        <Badge variant={o.type === "purchase" ? "primary" : "neutral"}>
                          {o.type?.toUpperCase()}
                        </Badge>
                      </td>
                      <td>{o.partyName}</td>
                      <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td style={{ textAlign: "right" }}>{o.items?.length || 0}</td>
                      <td style={{ textAlign: "right" }}>${(o.subtotal || 0).toFixed(2)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent-primary)" }}>
                        ${(o.grandTotal || 0).toFixed(2)}
                      </td>
                      <td>
                        <Badge variant="success">{o.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
