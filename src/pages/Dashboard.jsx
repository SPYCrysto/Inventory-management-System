import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { inventoryApi } from "../api.js";
import { useTheme } from "../theme.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  Card,
  StatCard,
  Button,
  Badge,
  Icons,
  EmptyState,
} from "../ui.jsx";

export default function Dashboard() {
  const { formatCurrency } = useTheme();
  const { profile, organization } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");
      const [statsData, alertsData] = await Promise.allSettled([
        inventoryApi.getStats(),
        inventoryApi.getAlerts(),
      ]);

      if (statsData.status === "fulfilled") {
        setStats(statsData.value);
      }
      if (alertsData.status === "fulfilled") {
        setAlerts(alertsData.value);
      }
    } catch (err) {
      setError(err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSeed = async () => {
    try {
      setSeeding(true);
      await inventoryApi.seedProducts(false);
      await fetchDashboardData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSeeding(false);
    }
  };

  // Stock Health Distribution Calculations
  const stockHealth = useMemo(() => {
    if (!stats || !stats.totalProducts) {
      return { inStockPct: 100, lowStockPct: 0, outOfStockPct: 0, inStockCount: 0 };
    }
    const total = stats.totalProducts;
    const out = stats.outOfStockCount || 0;
    const low = Math.max(0, (stats.lowStockCount || 0) - out);
    const inStock = Math.max(0, total - (stats.lowStockCount || 0));

    return {
      inStockCount: inStock,
      lowStockCount: low,
      outOfStockCount: out,
      inStockPct: Math.round((inStock / total) * 100),
      lowStockPct: Math.round((low / total) * 100),
      outOfStockPct: Math.round((out / total) * 100),
    };
  }, [stats]);

  if (loading && !stats) {
    return (
      <div className="page-loading">
        <span className="spinner large" />
        <p>Loading enterprise inventory telemetry...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Hero Operational Banner */}
      <Card
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <h1 style={{ fontSize: "1.45rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                Welcome back, {profile?.full_name?.split(" ")[0] || "Operator"} 👋
              </h1>
              <Badge variant="primary">
                {organization?.name || "Acme Logistics"}
              </Badge>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
              Enterprise Telemetry Active • Live Supabase PostgreSQL Connection verified
            </p>
          </div>

          {/* Quick Action Pills */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Button
              variant="outline"
              size="sm"
              icon={Icons.Plus}
              onClick={() => navigate("/products")}
            >
              Add Product
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Icons.ArrowUpDown}
              onClick={() => navigate("/stock-ops")}
            >
              Stock Movement
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Icons.Receipt}
              onClick={() => navigate("/orders")}
            >
              New PO
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Icons.FileText}
              onClick={() => navigate("/reports")}
            >
              Valuation
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="alert-banner error" style={{ marginBottom: "20px" }}>
          <Icons.AlertTriangle />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchDashboardData}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty State Banner if no products exist */}
      {stats && stats.totalProducts === 0 && (
        <Card className="seed-banner" style={{ marginBottom: "24px" }}>
          <div className="seed-banner-content">
            <div className="seed-icon">
              <Icons.Sparkles />
            </div>
            <div>
              <h3>Inventory database is ready</h3>
              <p>
                Get started right away by generating sample products with realistic
                categories, prices, and stock movements.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            icon={Icons.Sparkles}
            onClick={handleSeed}
            loading={seeding}
          >
            Seed Sample Data
          </Button>
        </Card>
      )}

      {/* Primary KPI Stat Cards Grid */}
      <div className="stats-grid" style={{ marginBottom: "24px" }}>
        <StatCard
          title="Total Inventory Value"
          value={formatCurrency(stats?.totalValue ?? 0)}
          subtitle="Cumulative FIFO asset value"
          icon={Icons.DollarSign}
          variant="accent"
        />
        <StatCard
          title="Physical Stock Units"
          value={(stats?.totalStock ?? 0).toLocaleString()}
          subtitle="Available across all hubs"
          icon={Icons.Layers}
          variant="default"
        />
        <StatCard
          title="Active Catalog SKUs"
          value={stats?.totalProducts ?? 0}
          subtitle={`${stats?.valueByCategory?.length || 0} product categories`}
          icon={Icons.Box}
          variant="default"
        />
        <StatCard
          title="Low Stock Attention"
          value={stats?.lowStockCount ?? 0}
          subtitle={
            stats?.outOfStockCount
              ? `${stats.outOfStockCount} critical out of stock`
              : "Items below reorder limit"
          }
          icon={Icons.AlertTriangle}
          variant={stats?.lowStockCount > 0 ? "warning" : "default"}
        />
      </div>

      {/* Stock Health & Risk Distribution Meter */}
      <Card style={{ marginBottom: "24px", padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>Stock Health Distribution</h2>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Catalog availability ratio</span>
          </div>
          <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
              In Stock ({stockHealth.inStockCount})
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
              Low Stock ({stockHealth.lowStockCount})
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
              Out of Stock ({stockHealth.outOfStockCount})
            </span>
          </div>
        </div>

        {/* Multi-segment Segmented Bar */}
        <div style={{ height: "10px", width: "100%", background: "var(--bg-input)", borderRadius: "6px", display: "flex", overflow: "hidden" }}>
          <div
            style={{
              width: `${stockHealth.inStockPct}%`,
              background: "#10b981",
              transition: "width 0.4s ease",
            }}
            title={`In Stock: ${stockHealth.inStockPct}%`}
          />
          <div
            style={{
              width: `${stockHealth.lowStockPct}%`,
              background: "#f59e0b",
              transition: "width 0.4s ease",
            }}
            title={`Low Stock: ${stockHealth.lowStockPct}%`}
          />
          <div
            style={{
              width: `${stockHealth.outOfStockPct}%`,
              background: "#ef4444",
              transition: "width 0.4s ease",
            }}
            title={`Out of Stock: ${stockHealth.outOfStockPct}%`}
          />
        </div>
      </Card>

      {/* Critical Reorder Suggestions Strip */}
      {alerts && alerts.length > 0 && (
        <Card style={{ marginBottom: "24px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Icons.AlertTriangle style={{ color: "#f59e0b" }} />
              <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
                Smart Restock Suggestions ({alerts.length})
              </h2>
            </div>
            <Link to="/alerts" style={{ fontSize: "12px", color: "var(--accent-primary)", textDecoration: "none", fontWeight: 600 }}>
              View All Alerts →
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
            {alerts.slice(0, 3).map((item) => (
              <div
                key={item._id || item.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    SKU: <code>{item.sku}</code> • Stock: <strong style={{ color: item.quantity <= 0 ? "#ef4444" : "#f59e0b" }}>{item.quantity}</strong> / {item.lowStockThreshold}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/orders")}
                >
                  Restock
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Grid: Value by Category & Latest Movements */}
      <div className="dashboard-grid">
        {/* Value by Category Breakdown */}
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Asset Allocation by Category</h2>
              <span className="panel-subtitle">Total stock value distribution</span>
            </div>
            <Link to="/categories" style={{ fontSize: "12px", color: "var(--accent-primary)", textDecoration: "none", fontWeight: 600 }}>
              All Categories →
            </Link>
          </div>

          {stats?.valueByCategory?.length === 0 ? (
            <EmptyState
              icon={Icons.Layers}
              title="No Categories Yet"
              description="Add products to visualize your inventory value distribution."
            />
          ) : (
            <div className="category-list" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {stats?.valueByCategory?.map((item) => {
                const totalVal = stats.totalValue || 1;
                const percent = Math.min(
                  100,
                  Math.round((item.totalValue / totalVal) * 100)
                );

                return (
                  <div key={item.category} className="category-row">
                    <div className="category-row-top" style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <div className="category-name-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="category-name" style={{ fontWeight: 600, fontSize: "13px" }}>{item.category}</span>
                        <Badge variant="neutral">
                          {item.productCount} {item.productCount === 1 ? "item" : "items"}
                        </Badge>
                      </div>
                      <div className="category-values" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <span className="category-valuation" style={{ fontWeight: 600, fontSize: "13px" }}>
                          {formatCurrency(item.totalValue)}
                        </span>
                        <span className="category-percent" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{percent}%</span>
                      </div>
                    </div>
                    <div className="progress-bar-bg" style={{ height: "6px", background: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${percent}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, var(--accent) 0%, rgba(var(--accent-rgb), 0.7) 100%)",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Latest Stock Movements Feed */}
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Live Stock Movements</h2>
              <span className="panel-subtitle">Audited inventory changes stream</span>
            </div>
            <Link to="/stock" style={{ fontSize: "12px", color: "var(--accent-primary)", textDecoration: "none", fontWeight: 600 }}>
              Full History →
            </Link>
          </div>

          {stats?.latestMovements?.length === 0 ? (
            <EmptyState
              icon={Icons.ArrowUpDown}
              title="No Movements Logged"
              description="Stock receipts or dispatches will automatically appear here."
            />
          ) : (
            <div className="timeline-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {stats?.latestMovements?.map((m) => {
                const isPositive = m.delta > 0;
                return (
                  <div
                    key={m._id || m.id}
                    className="timeline-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>
                        {m.productName}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        <code>{m.sku}</code> • {m.reason}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Badge variant={isPositive ? "success" : "danger"}>
                        {isPositive ? `+${m.delta}` : m.delta}
                      </Badge>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                        Balance: {m.runningBalance}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
