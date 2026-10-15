import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "./theme.jsx";
import { inventoryApi } from "./api.js";
import { useToast } from "./toast.jsx";
import { Modal, Button, Icons, Badge } from "./ui.jsx";

// Command Palette Extension (Ctrl + K / Cmd + K)
export function CommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { theme, setTheme, formatCurrency } = useTheme();
  const { showToast } = useToast();

  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setLoading(true);
      inventoryApi
        .getProducts()
        .then((data) => setProducts(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const quickNav = [
    { label: "Go to Dashboard", path: "/", icon: Icons.Layers },
    { label: "Go to Products Catalog", path: "/products", icon: Icons.Box },
    { label: "Go to Stock History Log", path: "/stock", icon: Icons.ArrowUpDown },
    { label: "Go to Low Stock Alerts", path: "/alerts", icon: Icons.AlertTriangle },
    { label: "Go to Settings & Appearance", path: "/settings", icon: Icons.Settings },
  ];

  const filteredNav = quickNav.filter((n) =>
    n.label.toLowerCase().includes(query.toLowerCase())
  );

  const filteredProducts = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 8);

  const handleAction = (callback) => {
    onClose();
    callback();
  };

  return (
    <div className="modal-backdrop command-backdrop" onClick={onClose}>
      <div
        className="command-palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-search-row">
          <Icons.Search className="command-icon" />
          <input
            type="text"
            className="command-input"
            placeholder="Type a command, search products, or jump to page... (ESC to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="command-esc-badge">ESC</kbd>
        </div>

        <div className="command-results-list">
          {/* Quick Navigation Items */}
          <div className="command-section-label">Navigation & Shortcuts</div>
          {filteredNav.map((item) => (
            <div
              key={item.path}
              className="command-item"
              onClick={() => handleAction(() => navigate(item.path))}
            >
              <item.icon className="command-item-icon" />
              <span className="command-item-text">{item.label}</span>
              <span className="command-item-hint">Jump</span>
            </div>
          ))}

          {/* Quick Controls */}
          <div className="command-section-label">Actions</div>
          <div
            className="command-item"
            onClick={() =>
              handleAction(() => {
                const nextTheme = theme === "dark" ? "light" : "dark";
                setTheme(nextTheme);
                showToast(`Switched to ${nextTheme} mode`, "info");
              })
            }
          >
            {theme === "dark" ? <Icons.Sun /> : <Icons.Moon />}
            <span className="command-item-text">
              Toggle Theme (Currently {theme})
            </span>
            <span className="command-item-hint">Action</span>
          </div>

          {/* Products Search Results */}
          {filteredProducts.length > 0 && (
            <>
              <div className="command-section-label">Matching Products ({filteredProducts.length})</div>
              {filteredProducts.map((p) => (
                <div
                  key={p._id}
                  className="command-item product-result"
                  onClick={() =>
                    handleAction(() => {
                      navigate(`/products`);
                    })
                  }
                >
                  <Icons.Box className="command-item-icon" />
                  <div className="command-product-info">
                    <span className="cmd-prod-name">{p.name}</span>
                    <span className="cmd-prod-meta">
                      SKU: {p.sku} • {p.category} • {p.quantity} in stock
                    </span>
                  </div>
                  <span className="cmd-prod-price">
                    {formatCurrency(p.price)}
                  </span>
                </div>
              ))}
            </>
          )}

          {query && filteredNav.length === 0 && filteredProducts.length === 0 && (
            <div className="command-empty">No matching actions or products found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Printable Barcode & Asset Tag Modal Extension
export function BarcodeModal({ product, isOpen, onClose }) {
  const { formatCurrency } = useTheme();
  const { showToast } = useToast();

  if (!isOpen || !product) return null;

  const handleCopySku = () => {
    navigator.clipboard.writeText(product.sku);
    showToast(`SKU '${product.sku}' copied to clipboard!`, "success");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Asset Tag & Barcode Preview" maxWidth="460px">
      <div className="barcode-tag-container" id="printable-asset-tag">
        <div className="tag-header">
          <span className="tag-brand">INVENTRA ASSET TAG</span>
          <span className="tag-category">{product.category}</span>
        </div>

        <div className="tag-body">
          <h2 className="tag-product-title">{product.name}</h2>
          <div className="tag-details-row">
            <span>
              Price: <strong>{formatCurrency(product.price)}</strong>
            </span>
            <span>
              Stock: <strong>{product.quantity} units</strong>
            </span>
          </div>

          {/* Simulated Code-128 High Resolution Barcode SVG */}
          <div className="barcode-svg-wrapper">
            <svg viewBox="0 0 280 80" className="barcode-svg" preserveAspectRatio="none">
              {/* Distinct bars simulating Code-128 */}
              <rect x="10" y="0" width="3" height="60" fill="currentColor" />
              <rect x="15" y="0" width="2" height="60" fill="currentColor" />
              <rect x="20" y="0" width="5" height="60" fill="currentColor" />
              <rect x="28" y="0" width="2" height="60" fill="currentColor" />
              <rect x="33" y="0" width="4" height="60" fill="currentColor" />
              <rect x="40" y="0" width="2" height="60" fill="currentColor" />
              <rect x="45" y="0" width="6" height="60" fill="currentColor" />
              <rect x="54" y="0" width="3" height="60" fill="currentColor" />
              <rect x="60" y="0" width="2" height="60" fill="currentColor" />
              <rect x="65" y="0" width="5" height="60" fill="currentColor" />
              <rect x="73" y="0" width="2" height="60" fill="currentColor" />
              <rect x="78" y="0" width="4" height="60" fill="currentColor" />
              <rect x="85" y="0" width="3" height="60" fill="currentColor" />
              <rect x="91" y="0" width="2" height="60" fill="currentColor" />
              <rect x="96" y="0" width="6" height="60" fill="currentColor" />
              <rect x="105" y="0" width="3" height="60" fill="currentColor" />
              <rect x="111" y="0" width="4" height="60" fill="currentColor" />
              <rect x="118" y="0" width="2" height="60" fill="currentColor" />
              <rect x="123" y="0" width="5" height="60" fill="currentColor" />
              <rect x="131" y="0" width="3" height="60" fill="currentColor" />
              <rect x="137" y="0" width="2" height="60" fill="currentColor" />
              <rect x="142" y="0" width="6" height="60" fill="currentColor" />
              <rect x="151" y="0" width="3" height="60" fill="currentColor" />
              <rect x="157" y="0" width="4" height="60" fill="currentColor" />
              <rect x="164" y="0" width="2" height="60" fill="currentColor" />
              <rect x="169" y="0" width="5" height="60" fill="currentColor" />
              <rect x="177" y="0" width="3" height="60" fill="currentColor" />
              <rect x="183" y="0" width="2" height="60" fill="currentColor" />
              <rect x="188" y="0" width="6" height="60" fill="currentColor" />
              <rect x="197" y="0" width="2" height="60" fill="currentColor" />
              <rect x="202" y="0" width="4" height="60" fill="currentColor" />
              <rect x="209" y="0" width="3" height="60" fill="currentColor" />
              <rect x="215" y="0" width="2" height="60" fill="currentColor" />
              <rect x="220" y="0" width="6" height="60" fill="currentColor" />
              <rect x="229" y="0" width="3" height="60" fill="currentColor" />
              <rect x="235" y="0" width="5" height="60" fill="currentColor" />
              <rect x="243" y="0" width="2" height="60" fill="currentColor" />
              <rect x="248" y="0" width="4" height="60" fill="currentColor" />
              <rect x="255" y="0" width="2" height="60" fill="currentColor" />
              <rect x="260" y="0" width="4" height="60" fill="currentColor" />
              <rect x="267" y="0" width="3" height="60" fill="currentColor" />
            </svg>
            <div className="barcode-sku-text">{product.sku}</div>
          </div>
        </div>
      </div>

      <div className="modal-actions">
        <Button variant="ghost" onClick={handleCopySku}>
          Copy SKU
        </Button>
        <Button variant="secondary" onClick={handlePrint}>
          Print Tag
        </Button>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
