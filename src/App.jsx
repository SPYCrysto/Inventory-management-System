import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import { ThemeProvider, useTheme } from "./theme.jsx";
import { ToastProvider, useToast } from "./toast.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { CommandPalette } from "./extensions.jsx";
import { inventoryApi } from "./api.js";
import { Icons, Badge } from "./ui.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import Products from "./pages/Products.jsx";
import Categories from "./pages/Categories.jsx";
import StockOperations from "./pages/StockOperations.jsx";
import Stock from "./pages/Stock.jsx";
import Alerts from "./pages/Alerts.jsx";
import Settings from "./pages/Settings.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import Orders from "./pages/Orders.jsx";
import Reports from "./pages/Reports.jsx";
import Team from "./pages/Team.jsx";
import Todos from "./pages/Todos.jsx";

function AppLayout() {
  const { theme, setTheme } = useTheme();
  const { user, profile, role, organization } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const [healthStatus, setHealthStatus] = useState("checking");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const checkStatus = async () => {
    try {
      const [alerts, health] = await Promise.allSettled([
        inventoryApi.getAlerts(),
        inventoryApi.getHealth(),
      ]);

      if (alerts.status === "fulfilled") {
        setAlertCount(alerts.value.length);
      }
      if (health.status === "fulfilled") {
        setHealthStatus(
          health.value.database === "connected" || health.value.database === "online"
            ? "online"
            : "connecting"
        );
      } else {
        setHealthStatus("connecting");
      }
    } catch {
      setHealthStatus("connecting");
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Global Keyboard listener for Command Palette (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <Link to="/" className="brand-logo">
            <div className="brand-icon">
              <Icons.Box />
            </div>
            <div className="brand-text">
              <span className="brand-name">Inventra</span>
              <span className="brand-tag">Enterprise</span>
            </div>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">CORE OPERATIONS</div>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.Layers className="nav-icon" />
            <span className="nav-label">Dashboard</span>
          </NavLink>

          <NavLink
            to="/products"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.Box className="nav-icon" />
            <span className="nav-label">Products</span>
          </NavLink>

          <NavLink
            to="/categories"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.Folder className="nav-icon" />
            <span className="nav-label">Categories</span>
          </NavLink>

          <NavLink
            to="/stock-ops"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.ArrowUpDown className="nav-icon" />
            <span className="nav-label">Stock Operations</span>
          </NavLink>

          <NavLink
            to="/stock"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.Clock className="nav-icon" />
            <span className="nav-label">Stock History</span>
          </NavLink>

          <div className="nav-section-title">SUPPLY CHAIN</div>
          <NavLink
            to="/suppliers"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.Truck className="nav-icon" />
            <span className="nav-label">Suppliers</span>
          </NavLink>

          <NavLink
            to="/orders"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.Receipt className="nav-icon" />
            <span className="nav-label">Purchase Orders</span>
          </NavLink>

          <NavLink
            to="/alerts"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.AlertTriangle className="nav-icon" />
            <span className="nav-label">Smart Alerts</span>
            {alertCount > 0 && <span className="nav-badge-alert">{alertCount}</span>}
          </NavLink>

          <div className="nav-section-title">ANALYTICS & TEAM</div>
          <NavLink
            to="/reports"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.FileText className="nav-icon" />
            <span className="nav-label">Reports & Valuation</span>
          </NavLink>

          <NavLink
            to="/team"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.Users className="nav-icon" />
            <span className="nav-label">Team & RBAC</span>
          </NavLink>

          <NavLink
            to="/todos"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.Database className="nav-icon" />
            <span className="nav-label">Supabase Sync</span>
          </NavLink>

          <div className="nav-divider" />

          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icons.Settings className="nav-icon" />
            <span className="nav-label">Settings</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer with Live Connection Status */}
        <div className="sidebar-footer">
          <div className="storage-badge">
            <span className={`status-dot ${healthStatus}`} />
            <div className="storage-info">
              <span className="storage-title">Supabase Cloud</span>
              <span className="storage-desc">
                {healthStatus === "online" ? "Postgres Connected" : "Connecting..."}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Top Header Bar */}
        <header className="app-header">
          {/* Quick Command Palette Launcher */}
          <button
            className="command-trigger-btn"
            onClick={() => setCommandPaletteOpen(true)}
          >
            <Icons.Search />
            <span>Search or command palette...</span>
            <kbd className="cmd-shortcut">Ctrl K</kbd>
          </button>

          <div className="header-right" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* User Profile & Role Tag */}
            <Link
              to="/team"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
                color: "inherit",
                padding: "4px 8px",
                borderRadius: "6px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "var(--accent-primary)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                {profile?.full_name?.charAt(0) || "U"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, lineHeight: 1.2 }}>
                  {profile?.full_name?.split(" ")[0] || "User"}
                </span>
                <span style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  {role}
                </span>
              </div>
            </Link>

            <button
              className="btn-theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Icons.Sun /> : <Icons.Moon />}
            </button>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/stock-ops" element={<StockOperations />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/team" element={<Team />} />
            <Route path="/todos" element={<Todos />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>

      {/* Command Palette Modal (UI Extension) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppLayout />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
