import React, { useEffect, useState } from "react";
import { useTheme, ACCENTS, CURRENCIES } from "../theme.jsx";
import { inventoryApi } from "../api.js";
import { Card, Button, Input, Badge, Icons } from "../ui.jsx";

export default function Settings() {
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    density,
    setDensity,
    currency,
    setCurrency,
    defaultThreshold,
    setDefaultThreshold,
    resetDefaults,
    formatCurrency,
  } = useTheme();

  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const fetchHealth = async () => {
    try {
      setHealthLoading(true);
      const data = await inventoryApi.getHealth();
      setHealth(data);
    } catch (err) {
      setHealth({ status: "error", message: err.message });
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const triggerSaved = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Application Settings</h1>
          <p className="page-subtitle">
            Personalize your workspace aesthetics, regional currency, and default thresholds (saved per browser)
          </p>
        </div>
        <div className="header-actions">
          {savedNotice && (
            <Badge variant="success" size="lg">
              <Icons.Check /> Preferences Saved
            </Badge>
          )}
          <Button variant="ghost" icon={Icons.RefreshCw} onClick={resetDefaults}>
            Reset Defaults
          </Button>
        </div>
      </div>

      <div className="settings-grid">
        {/* Appearance & Theme Card */}
        <Card className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">Theme & Color Mode</h2>
            <p className="settings-card-desc">
              Choose your preferred visual mode for day or night operation
            </p>
          </div>

          <div className="theme-options-grid">
            <button
              className={`theme-box ${theme === "dark" ? "active" : ""}`}
              onClick={() => {
                setTheme("dark");
                triggerSaved();
              }}
            >
              <div className="theme-preview dark-preview">
                <div className="preview-nav" />
                <div className="preview-content" />
              </div>
              <span>Dark Mode</span>
            </button>

            <button
              className={`theme-box ${theme === "light" ? "active" : ""}`}
              onClick={() => {
                setTheme("light");
                triggerSaved();
              }}
            >
              <div className="theme-preview light-preview">
                <div className="preview-nav" />
                <div className="preview-content" />
              </div>
              <span>Light Mode</span>
            </button>

            <button
              className={`theme-box ${theme === "system" ? "active" : ""}`}
              onClick={() => {
                setTheme("system");
                triggerSaved();
              }}
            >
              <div className="theme-preview system-preview">
                <div className="preview-split-left" />
                <div className="preview-split-right" />
              </div>
              <span>System Sync</span>
            </button>
          </div>
        </Card>

        {/* Accent Color Palette Card */}
        <Card className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">Accent Color Palette</h2>
            <p className="settings-card-desc">
              Dynamically tint badges, buttons, active states, and glow highlights
            </p>
          </div>

          <div className="accents-grid">
            {Object.entries(ACCENTS).map(([key, item]) => {
              const isActive = accent === key;
              return (
                <button
                  key={key}
                  className={`accent-chip ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setAccent(key);
                    triggerSaved();
                  }}
                  style={{
                    "--swatch-color": item.color,
                  }}
                >
                  <span
                    className="accent-swatch"
                    style={{ backgroundColor: item.color }}
                  >
                    {isActive && <Icons.Check />}
                  </span>
                  <span className="accent-name">{item.name}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Interface Density & Currency */}
        <Card className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">Density & Regional Formats</h2>
            <p className="settings-card-desc">
              Adjust spacing scale and financial currency formatting
            </p>
          </div>

          <div className="settings-form-section">
            <div className="form-group">
              <label className="form-label">Table & Card Density</label>
              <div className="density-toggle-group">
                <button
                  className={`density-btn ${density === "compact" ? "active" : ""}`}
                  onClick={() => {
                    setDensity("compact");
                    triggerSaved();
                  }}
                >
                  Compact
                </button>
                <button
                  className={`density-btn ${density === "normal" ? "active" : ""}`}
                  onClick={() => {
                    setDensity("normal");
                    triggerSaved();
                  }}
                >
                  Normal
                </button>
                <button
                  className={`density-btn ${density === "relaxed" ? "active" : ""}`}
                  onClick={() => {
                    setDensity("relaxed");
                    triggerSaved();
                  }}
                >
                  Relaxed
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Display Currency</label>
              <select
                className="form-select"
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  triggerSaved();
                }}
              >
                {Object.entries(CURRENCIES).map(([k, c]) => (
                  <option key={k} value={k}>
                    {c.name}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                Sample preview: <strong>{formatCurrency(1249.5)}</strong>
              </small>
            </div>
          </div>
        </Card>

        {/* Default Alert Threshold */}
        <Card className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">Stock Alert Defaults</h2>
            <p className="settings-card-desc">
              Pre-filled threshold when creating new inventory products
            </p>
          </div>

          <div className="settings-form-section">
            <Input
              label="Default Alert Threshold (Units)"
              type="number"
              min="1"
              value={defaultThreshold}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                setDefaultThreshold(val);
                triggerSaved();
              }}
            />
            <p className="form-hint">
              Products with quantity less than or equal to this threshold will be flagged in Low Stock Alerts.
            </p>
          </div>
        </Card>

        {/* Live System & Cloud Architecture Info */}
        <Card className="settings-card full-width">
          <div className="settings-card-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="settings-card-title">System & Cloud Storage Status</h2>
                <p className="settings-card-desc">
                  Live diagnostics for Express API, Supabase Cloud Postgres, and Vercel serverless deployment
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={Icons.RefreshCw}
                onClick={fetchHealth}
                loading={healthLoading}
              >
                Check Liveness
              </Button>
            </div>
          </div>

          <div className="health-metrics-grid">
            <div className="health-box">
              <span className="health-label">API Status</span>
              <div className="health-value-group">
                <span className="status-indicator online" />
                <span className="health-val">
                  {health?.status ? health.status.toUpperCase() : "CHECKING..."}
                </span>
              </div>
            </div>

            <div className="health-box">
              <span className="health-label">Database Connection</span>
              <div className="health-value-group">
                <span
                  className={`status-indicator ${
                    health?.database === "connected" ? "online" : "offline"
                  }`}
                />
                <span className="health-val">
                  {health?.database || "Connecting..."}
                </span>
              </div>
            </div>

            <div className="health-box">
              <span className="health-label">Vercel Serverless Ready</span>
              <div className="health-value-group">
                <span className="status-indicator online" />
                <span className="health-val">Yes (api/index.js)</span>
              </div>
            </div>

            <div className="health-box">
              <span className="health-label">Server Uptime</span>
              <span className="health-val">
                {health?.uptime !== undefined ? `${health.uptime}s` : "--"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
