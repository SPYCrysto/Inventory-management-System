import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { inventoryApi } from "../api.js";
import { useTheme } from "../theme.jsx";
import { useToast } from "../toast.jsx";
import {
  Card,
  Button,
  Badge,
  Modal,
  Input,
  Icons,
  EmptyState,
} from "../ui.jsx";

export default function Alerts() {
  const { formatCurrency } = useTheme();
  const { showToast } = useToast();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restockingId, setRestockingId] = useState(null);
  const [bulkRestocking, setBulkRestocking] = useState(false);

  // Custom Restock Modal
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState(null);
  const [customAmount, setCustomAmount] = useState(25);
  const [customReason, setCustomReason] = useState("Urgent Alert Restock");
  const [submitting, setSubmitting] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await inventoryApi.getAlerts();
      setAlerts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  // Quick One-Click Restock handler
  const handleQuickRestock = async (product, amount) => {
    try {
      setRestockingId(product._id);
      await inventoryApi.adjustStock(product._id, {
        delta: amount,
        reason: `One-Click Restock (+${amount} units)`,
      });
      showToast(
        `Restocked +${amount} units for ${product.name}`,
        "success"
      );
      await fetchAlerts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setRestockingId(null);
    }
  };

  // Bulk Replenish All Alerts (+10 to each item)
  const handleRestockAllAlerts = async () => {
    if (alerts.length === 0) return;
    try {
      setBulkRestocking(true);
      await Promise.all(
        alerts.map((p) =>
          inventoryApi.adjustStock(p._id, {
            delta: 10,
            reason: "Bulk Emergency Alert Restock (+10 units)",
          })
        )
      );
      showToast(
        `Replenished +10 units to all ${alerts.length} low-stock products!`,
        "success"
      );
      await fetchAlerts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBulkRestocking(false);
    }
  };

  const openCustomModal = (product) => {
    setTargetProduct(product);
    const needed = Math.max(
      10,
      product.lowStockThreshold - product.quantity + 10
    );
    setCustomAmount(needed);
    setCustomReason("Threshold Recovery Restock");
    setCustomModalOpen(true);
  };

  const handleCustomRestock = async (e) => {
    e.preventDefault();
    if (!targetProduct) return;

    try {
      setSubmitting(true);
      const delta = parseInt(customAmount, 10) || 10;
      await inventoryApi.adjustStock(targetProduct._id, {
        delta,
        reason: customReason,
      });
      setCustomModalOpen(false);
      showToast(
        `Added +${delta} units to ${targetProduct.name}`,
        "success"
      );
      await fetchAlerts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Low Stock Alerts</h1>
          <p className="page-subtitle">
            Items requiring immediate replenishment with instant one-click restocking
          </p>
        </div>
        <div className="header-actions">
          {alerts.length > 0 && (
            <Button
              variant="accent"
              icon={Icons.Sparkles}
              onClick={handleRestockAllAlerts}
              loading={bulkRestocking}
            >
              Restock All (+10 each)
            </Button>
          )}
          <Button
            variant="ghost"
            icon={Icons.RefreshCw}
            onClick={fetchAlerts}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="alert-banner error">
          <Icons.AlertTriangle />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchAlerts}>
            Retry
          </Button>
        </div>
      )}

      {loading && alerts.length === 0 ? (
        <div className="page-loading">
          <span className="spinner large" />
          <p>Scanning inventory for low-stock items...</p>
        </div>
      ) : alerts.length === 0 ? (
        <Card className="empty-panel success-state">
          <EmptyState
            icon={Icons.Check}
            title="All Stock Levels Healthy"
            description="No items currently breach their assigned low-stock thresholds. Great job managing supply!"
            action={
              <Link to="/products">
                <Button variant="primary">View Full Catalog</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="alerts-container">
          <div className="alert-summary-banner">
            <Icons.AlertTriangle />
            <span>
              <strong>{alerts.length} product(s)</strong> require restocking attention. Use the one-click action buttons below or bulk restock all.
            </span>
          </div>

          <div className="alerts-grid">
            {alerts.map((p) => {
              const isOut = p.quantity <= 0;
              const ratio =
                p.lowStockThreshold > 0
                  ? (p.quantity / p.lowStockThreshold) * 100
                  : 0;
              const percent = Math.min(100, Math.max(0, Math.round(ratio)));
              const isBusy = restockingId === p._id;

              return (
                <Card
                  key={p._id}
                  className={`alert-card ${isOut ? "critical" : "warning"}`}
                >
                  <div className="alert-card-header">
                    <div>
                      <span className="category-tag">{p.category}</span>
                      <h3 className="alert-product-title">{p.name}</h3>
                      <code className="sku-badge">{p.sku}</code>
                    </div>
                    <div>
                      {isOut ? (
                        <Badge variant="danger" size="lg">
                          CRITICAL: Out of Stock
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="lg">
                          Low Stock Warning
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Meter */}
                  <div className="alert-meter-section">
                    <div className="meter-labels">
                      <span className="current-level">
                        Current: <strong>{p.quantity} units</strong>
                      </span>
                      <span className="target-level">
                        Threshold: {p.lowStockThreshold} units
                      </span>
                    </div>
                    <div className="alert-meter-bg">
                      <div
                        className={`alert-meter-fill ${isOut ? "out" : "low"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Restock Bar */}
                  <div className="one-click-restock-bar">
                    <span className="restock-label">One-Click Restock:</span>
                    <div className="restock-buttons">
                      <button
                        className="btn-restock"
                        disabled={isBusy}
                        onClick={() => handleQuickRestock(p, 10)}
                      >
                        +10
                      </button>
                      <button
                        className="btn-restock"
                        disabled={isBusy}
                        onClick={() => handleQuickRestock(p, 25)}
                      >
                        +25
                      </button>
                      <button
                        className="btn-restock"
                        disabled={isBusy}
                        onClick={() => handleQuickRestock(p, 50)}
                      >
                        +50
                      </button>
                      <button
                        className="btn-restock custom"
                        disabled={isBusy}
                        onClick={() => openCustomModal(p)}
                      >
                        Custom...
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* CUSTOM RESTOCK MODAL */}
      <Modal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        title={`Custom Restock — ${targetProduct?.name || ""}`}
      >
        <form onSubmit={handleCustomRestock}>
          <div className="stock-modal-info">
            <span>
              Current: <strong>{targetProduct?.quantity} units</strong>
            </span>
            <span>Threshold: {targetProduct?.lowStockThreshold} units</span>
          </div>

          <Input
            label="Restock Quantity"
            type="number"
            min="1"
            value={customAmount}
            onChange={(e) =>
              setCustomAmount(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            required
          />

          <Input
            label="Reason / PO Reference"
            placeholder="e.g. Supplier PO #4092, Bulk Shipment"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            required
          />

          <div className="modal-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCustomModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Add +{customAmount} Units
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
