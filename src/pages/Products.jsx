import React, { useEffect, useState, useMemo } from "react";
import { inventoryApi } from "../api.js";
import { useTheme } from "../theme.jsx";
import { useToast } from "../toast.jsx";
import { BarcodeModal } from "../extensions.jsx";
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  ConfirmDialog,
  Icons,
  EmptyState,
} from "../ui.jsx";

export default function Products() {
  const { formatCurrency, defaultThreshold } = useTheme();
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Controls
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'card'

  // Multi-selection (Bulk Actions Extension)
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkRestockAmount, setBulkRestockAmount] = useState(10);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Modals & Drawers state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [drawerProduct, setDrawerProduct] = useState(null);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [productMovements, setProductMovements] = useState([]);

  // Active product selections
  const [currentProduct, setCurrentProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    quantity: 0,
    price: 0,
    lowStockThreshold: defaultThreshold,
  });

  const [stockForm, setStockForm] = useState({
    delta: 10,
    reason: "Restock",
    actionType: "in", // 'in' or 'out'
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await inventoryApi.getProducts();
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Distinct categories for filter
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  // KPI Metrics & Aggregations
  const totalValuation = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.quantity || 0) * (p.price || 0), 0);
  }, [products]);

  const totalUnits = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.quantity || 0), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.quantity > 0 && p.quantity <= p.lowStockThreshold).length;
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => (p.quantity || 0) <= 0).length;
  }, [products]);

  const categoryCounts = useMemo(() => {
    const counts = { All: products.length };
    products.forEach((p) => {
      const cat = p.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [products]);

  const getCategoryEmoji = (cat) => {
    switch (cat?.toLowerCase()) {
      case "electronics":
        return "⚡";
      case "hardware":
        return "🖥️";
      case "peripherals":
        return "🖱️";
      case "accessories":
        return "🔌";
      case "office":
        return "📝";
      default:
        return "📦";
    }
  };

  // Client-side filtering & sorting
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = p.name?.toLowerCase().includes(q);
          const matchSku = p.sku?.toLowerCase().includes(q);
          const matchCategory = p.category?.toLowerCase().includes(q);
          if (!matchName && !matchSku && !matchCategory) return false;
        }

        // Category filter
        if (categoryFilter !== "All" && p.category !== categoryFilter) {
          return false;
        }

        // Status filter
        if (statusFilter === "in_stock") {
          return p.quantity > p.lowStockThreshold;
        }
        if (statusFilter === "low_stock") {
          return p.quantity > 0 && p.quantity <= p.lowStockThreshold;
        }
        if (statusFilter === "out_of_stock") {
          return p.quantity <= 0;
        }

        return true;
      })
      .sort((a, b) => {
        let valA, valB;
        if (sortBy === "name") {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortBy === "quantity") {
          valA = a.quantity;
          valB = b.quantity;
        } else if (sortBy === "price") {
          valA = a.price;
          valB = b.price;
        } else if (sortBy === "totalValue") {
          valA = a.quantity * a.price;
          valB = b.quantity * b.price;
        } else if (sortBy === "category") {
          valA = a.category.toLowerCase();
          valB = b.category.toLowerCase();
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [products, search, categoryFilter, statusFilter, sortBy, sortOrder]);

  // Selection toggles
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredProducts.map((p) => p._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Bulk Actions
  const handleBulkRestock = async () => {
    if (selectedIds.length === 0) return;
    try {
      setBulkActionLoading(true);
      const promises = selectedIds.map((id) =>
        inventoryApi.adjustStock(id, {
          delta: bulkRestockAmount,
          reason: `Bulk Restock (+${bulkRestockAmount})`,
        })
      );
      await Promise.all(promises);
      showToast(
        `Successfully replenished +${bulkRestockAmount} units to ${selectedIds.length} products!`,
        "success"
      );
      setSelectedIds([]);
      await fetchProducts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedIds.length} selected products?`
      )
    ) {
      return;
    }
    try {
      setBulkActionLoading(true);
      await Promise.all(selectedIds.map((id) => inventoryApi.deleteProduct(id)));
      showToast(`Deleted ${selectedIds.length} products`, "success");
      setSelectedIds([]);
      await fetchProducts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // CSV Export
  const handleExportCSV = (listToExport = filteredProducts) => {
    if (listToExport.length === 0) return;

    const headers = [
      "SKU",
      "Name",
      "Category",
      "Quantity",
      "Price",
      "Total Value",
      "Threshold",
      "Status",
    ];
    const rows = listToExport.map((p) => {
      const status =
        p.quantity <= 0
          ? "Out of Stock"
          : p.quantity <= p.lowStockThreshold
          ? "Low Stock"
          : "In Stock";
      return [
        `"${p.sku}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category}"`,
        p.quantity,
        p.price,
        (p.quantity * p.price).toFixed(2),
        p.lowStockThreshold,
        status,
      ].join(",");
    });

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `inventra-products-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${listToExport.length} products to CSV`, "success");
  };

  // JSON Export
  const handleExportJSON = (listToExport = filteredProducts) => {
    if (listToExport.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(listToExport, null, 2)
    )}`;
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute(
      "download",
      `inventra-catalog-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${listToExport.length} products to JSON`, "success");
  };

  // Product Drawer Inspector
  const openProductDrawer = async (p) => {
    setDrawerProduct(p);
    try {
      const moves = await inventoryApi.getMovements({ productId: p._id });
      setProductMovements(moves.slice(0, 6));
    } catch {
      setProductMovements([]);
    }
  };

  // Quick In-line Stock Adjustment (+1 / -1)
  const handleQuickInlineAdjust = async (product, delta) => {
    const newQty = Math.max(0, (product.quantity || 0) + delta);
    setProducts((prev) =>
      prev.map((item) => (item._id === product._id ? { ...item, quantity: newQty } : item))
    );
    if (drawerProduct?._id === product._id) {
      setDrawerProduct((prev) => ({ ...prev, quantity: newQty }));
    }

    try {
      await inventoryApi.adjustStock(product._id, {
        delta,
        reason: delta > 0 ? "Quick Restock (+1)" : "Quick Dispatch (-1)",
      });
      showToast(
        `${delta > 0 ? "+1" : "-1"} unit on "${product.name}" (Now: ${newQty})`,
        "success"
      );
      inventoryApi.getMovements({ productId: product._id })
        .then((m) => setProductMovements(m.slice(0, 6)))
        .catch(() => {});
    } catch (err) {
      showToast(err.message, "error");
      fetchProducts();
    }
  };

  // Barcode / SKU Scanner Handler
  const handleScanSubmit = (scannedSkuOrCode) => {
    const query = (scannedSkuOrCode || scannerInput).trim().toLowerCase();
    if (!query) return;

    const matched = products.find(
      (p) =>
        p.sku?.toLowerCase() === query ||
        p.barcode?.toLowerCase() === query ||
        p.name?.toLowerCase().includes(query)
    );

    if (matched) {
      showToast(`Scanned product: "${matched.name}" (${matched.sku})`, "success");
      setScannerModalOpen(false);
      setScannerInput("");
      openProductDrawer(matched);
    } else {
      showToast(`No item found matching "${query}"`, "error");
    }
  };

  // Handlers for Add / Edit
  const openAddModal = () => {
    setFormData({
      name: "",
      sku: "",
      category: "General",
      quantity: 0,
      price: 0,
      lowStockThreshold: defaultThreshold,
    });
    setAddModalOpen(true);
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const created = await inventoryApi.createProduct(formData);
      setAddModalOpen(false);
      showToast(`Created product "${created.name}" (${created.sku})`, "success");
      await fetchProducts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      quantity: product.quantity,
      price: product.price,
      lowStockThreshold: product.lowStockThreshold,
    });
    setEditModalOpen(true);
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!currentProduct) return;
    try {
      setSubmitting(true);
      await inventoryApi.updateProduct(currentProduct._id, formData);
      setEditModalOpen(false);
      showToast(`Updated product "${formData.name}"`, "success");
      await fetchProducts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Stock Adjustment
  const openStockModal = (product) => {
    setCurrentProduct(product);
    setStockForm({
      delta: 10,
      reason: "Restock Shipment",
      actionType: "in",
    });
    setStockModalOpen(true);
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!currentProduct) return;
    try {
      setSubmitting(true);
      const rawDelta = Math.abs(parseInt(stockForm.delta, 10) || 0);
      const delta = stockForm.actionType === "out" ? -rawDelta : rawDelta;

      const res = await inventoryApi.adjustStock(currentProduct._id, {
        delta,
        reason: stockForm.reason,
      });

      setStockModalOpen(false);
      showToast(
        `${delta > 0 ? "Added +" : "Removed "}${Math.abs(delta)} units (${currentProduct.name})`,
        "success"
      );
      await fetchProducts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Barcode Preview Modal
  const openBarcodeModal = (product) => {
    setCurrentProduct(product);
    setBarcodeModalOpen(true);
  };

  // Delete
  const openDeleteDialog = (product) => {
    setCurrentProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteProduct = async () => {
    if (!currentProduct) return;
    try {
      setSubmitting(true);
      await inventoryApi.deleteProduct(currentProduct._id);
      setDeleteDialogOpen(false);
      showToast(`Deleted product "${currentProduct.name}"`, "info");
      await fetchProducts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeed = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.seedProducts(false);
      showToast(res.message, "success");
      await fetchProducts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const allSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedIds.includes(p._id));

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Products Inventory</h1>
          <p className="page-subtitle">
            Enterprise catalog management, real-time stock valuations, asset barcodes, and bulk operations
          </p>
        </div>
        <div className="header-actions">
          <Button
            variant="ghost"
            icon={Icons.Sparkles}
            onClick={handleSeed}
            title="Seed realistic sample inventory catalog"
          >
            Seed Demo Data
          </Button>
          <Button
            variant="secondary"
            icon={Icons.Box}
            onClick={() => setScannerModalOpen(true)}
            title="Scan physical asset barcode or SKU"
          >
            Scan Barcode
          </Button>
          <Button
            variant="secondary"
            icon={Icons.Download}
            onClick={() => handleExportJSON()}
            disabled={filteredProducts.length === 0}
            title="Export catalog to JSON format"
          >
            Export JSON
          </Button>
          <Button
            variant="secondary"
            icon={Icons.Download}
            onClick={() => handleExportCSV()}
            disabled={filteredProducts.length === 0}
          >
            Export CSV
          </Button>
          <Button variant="primary" icon={Icons.Plus} onClick={openAddModal}>
            Add Product
          </Button>
        </div>
      </div>

      {error && (
        <div className="alert-banner error">
          <Icons.AlertTriangle />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchProducts}>
            Retry
          </Button>
        </div>
      )}

      {/* 1. TOP KPI METRICS RIBBON */}
      <div className="product-kpi-ribbon">
        <div
          className="product-kpi-card"
          onClick={() => {
            setCategoryFilter("All");
            setStatusFilter("all");
          }}
          title="Click to reset filters and view all products"
        >
          <div className="kpi-main">
            <span className="kpi-title">Total Valuation</span>
            <span className="kpi-val">{formatCurrency(totalValuation)}</span>
            <span className="kpi-sub">Across active warehouse hubs</span>
          </div>
          <div className="kpi-icon-bubble primary">
            <Icons.DollarSign />
          </div>
        </div>

        <div
          className="product-kpi-card"
          onClick={() => {
            setStatusFilter("all");
          }}
          title="Total physical inventory items on hand"
        >
          <div className="kpi-main">
            <span className="kpi-title">Stock on Hand</span>
            <span className="kpi-val">{totalUnits.toLocaleString()} units</span>
            <span className="kpi-sub">In {products.length} catalog SKUs</span>
          </div>
          <div className="kpi-icon-bubble info">
            <Icons.Box />
          </div>
        </div>

        <div
          className={`product-kpi-card ${statusFilter === "low_stock" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "low_stock" ? "all" : "low_stock")}
          title="Click to filter Low Stock products"
        >
          <div className="kpi-main">
            <span className="kpi-title">Low Stock Alert</span>
            <span className="kpi-val" style={{ color: lowStockCount > 0 ? "#f59e0b" : "inherit" }}>
              {lowStockCount} items
            </span>
            <span className="kpi-sub">At or below reorder threshold</span>
          </div>
          <div className="kpi-icon-bubble warning">
            <Icons.AlertTriangle />
          </div>
        </div>

        <div
          className={`product-kpi-card ${statusFilter === "out_of_stock" ? "active-filter" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "out_of_stock" ? "all" : "out_of_stock")}
          title="Click to filter Out of Stock products"
        >
          <div className="kpi-main">
            <span className="kpi-title">Out of Stock</span>
            <span className="kpi-val" style={{ color: outOfStockCount > 0 ? "#ef4444" : "inherit" }}>
              {outOfStockCount} items
            </span>
            <span className="kpi-sub">Zero stock available</span>
          </div>
          <div className="kpi-icon-bubble danger">
            <Icons.AlertTriangle />
          </div>
        </div>
      </div>

      {/* 2. CATEGORY PILLS HORIZONTAL BAR */}
      <div className="category-pills-bar">
        {categories.map((cat) => {
          const count = categoryCounts[cat] || 0;
          const isActive = categoryFilter === cat;
          return (
            <button
              key={cat}
              className={`category-pill ${isActive ? "active" : ""}`}
              onClick={() => setCategoryFilter(cat)}
            >
              <span>{cat === "All" ? "📦 All Categories" : `${getCategoryEmoji(cat)} ${cat}`}</span>
              <span className="pill-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filter and Toolbar Bar */}
      <Card className="toolbar-card">
        <div className="toolbar-row">
          <div className="search-box">
            <Icons.Search className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, SKU, or category..."
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
            {/* Category Filter */}
            <select
              className="toolbar-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "All" ? "All Categories" : cat}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="toolbar-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="in_stock">In Stock (Healthy)</option>
              <option value="low_stock">Low Stock (≤ Threshold)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>

            {/* Sort Field */}
            <select
              className="toolbar-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Sort by Name</option>
              <option value="quantity">Sort by Quantity</option>
              <option value="price">Sort by Price</option>
              <option value="totalValue">Sort by Stock Value</option>
              <option value="category">Sort by Category</option>
            </select>

            {/* Sort Order Toggle */}
            <button
              className="btn-icon-toggle"
              title={`Sort ${sortOrder === "asc" ? "Descending" : "Ascending"}`}
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              <Icons.ArrowUpDown />
            </button>

            {/* Table / Card View Toggle */}
            <div className="view-toggle-group">
              <button
                className={`view-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Table view"
              >
                <Icons.List />
              </button>
              <button
                className={`view-btn ${viewMode === "card" ? "active" : ""}`}
                onClick={() => setViewMode("card")}
                title="Card grid view"
              >
                <Icons.LayoutGrid />
              </button>
            </div>
          </div>
        </div>

        {/* Counter & Active Filter Pills */}
        <div className="toolbar-meta">
          <span className="results-counter">
            Showing <strong>{filteredProducts.length}</strong> of{" "}
            <strong>{products.length}</strong> products
          </span>
          {(search || categoryFilter !== "All" || statusFilter !== "all") && (
            <button
              className="clear-all-link"
              onClick={() => {
                setSearch("");
                setCategoryFilter("All");
                setStatusFilter("all");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* FLOATING BULK ACTIONS TOOLBAR (UI EXTENSION) */}
      {selectedIds.length > 0 && (
        <div className="floating-bulk-toolbar">
          <div className="bulk-info">
            <span className="bulk-count-badge">{selectedIds.length}</span>
            <span>Products selected</span>
          </div>

          <div className="bulk-controls">
            <div className="bulk-restock-group">
              <input
                type="number"
                min="1"
                className="bulk-input"
                value={bulkRestockAmount}
                onChange={(e) =>
                  setBulkRestockAmount(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                title="Amount to add to each item"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleBulkRestock}
                loading={bulkActionLoading}
              >
                + Replenish Selected
              </Button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={Icons.Download}
              onClick={() =>
                handleExportCSV(
                  products.filter((p) => selectedIds.includes(p._id))
                )
              }
            >
              Export ({selectedIds.length})
            </Button>

            <Button
              variant="danger"
              size="sm"
              icon={Icons.Trash2}
              onClick={handleBulkDelete}
              loading={bulkActionLoading}
            >
              Delete
            </Button>

            <button
              className="btn-bulk-clear"
              onClick={() => setSelectedIds([])}
              title="Clear selection"
            >
              <Icons.X />
            </button>
          </div>
        </div>
      )}

      {/* Content: Table or Grid */}
      {loading && products.length === 0 ? (
        <div className="page-loading">
          <span className="spinner large" />
          <p>Fetching products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="empty-panel">
          <EmptyState
            icon={Icons.Box}
            title={
              products.length === 0
                ? "No Products in Catalog"
                : "No Matching Products Found"
            }
            description={
              products.length === 0
                ? "Start adding products or seed initial sample inventory."
                : "Try adjusting your search criteria or resetting filters."
            }
            action={
              products.length === 0 ? (
                <div style={{ display: "flex", gap: "10px" }}>
                  <Button variant="accent" icon={Icons.Sparkles} onClick={handleSeed}>
                    Seed Sample Data
                  </Button>
                  <Button variant="primary" icon={Icons.Plus} onClick={openAddModal}>
                    Add First Product
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("All");
                    setStatusFilter("all");
                  }}
                >
                  Clear Filters
                </Button>
              )
            }
          />
        </Card>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <Card className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      className="custom-checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Product</th>
                  <th>SKU / Asset</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Quantity</th>
                  <th style={{ textAlign: "right" }}>Unit Price</th>
                  <th style={{ textAlign: "right" }}>Stock Value</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const isOut = p.quantity <= 0;
                  const isLow = !isOut && p.quantity <= p.lowStockThreshold;
                  const totalVal = (p.quantity || 0) * (p.price || 0);
                  const isSelected = selectedIds.includes(p._id);

                  return (
                    <tr
                      key={p._id}
                      className={`${isOut ? "row-out" : isLow ? "row-low" : ""} ${
                        isSelected ? "row-selected" : ""
                      }`}
                    >
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(p._id)}
                        />
                      </td>
                      <td
                        style={{ cursor: "pointer" }}
                        onClick={() => openProductDrawer(p)}
                        title="Click to view detailed item inspector"
                      >
                        <div className="product-cell-name">
                          <span style={{ fontSize: "1.1rem" }}>{getCategoryEmoji(p.category)}</span>
                          <span className="product-name-text" style={{ fontWeight: 600 }}>{p.name}</span>
                        </div>
                      </td>
                      <td>
                        <button
                          className="sku-button"
                          onClick={() => openBarcodeModal(p)}
                          title="Click to view printable Barcode Asset Tag"
                        >
                          <code className="sku-badge">{p.sku}</code>
                          <span className="sku-tag-icon">🏷️</span>
                        </button>
                      </td>
                      <td>
                        <span className="category-tag">{p.category}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <button
                            className="btn-micro-qty"
                            title="Quick -1 unit"
                            disabled={p.quantity <= 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickInlineAdjust(p, -1);
                            }}
                          >
                            -
                          </button>
                          <span
                            className={`qty-value ${
                              isOut ? "qty-out" : isLow ? "qty-low" : ""
                            }`}
                          >
                            {p.quantity}
                          </span>
                          <button
                            className="btn-micro-qty"
                            title="Quick +1 unit"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickInlineAdjust(p, 1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <span className="threshold-hint" style={{ marginLeft: "4px" }}>
                          /{p.lowStockThreshold}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 500 }}>
                        {formatCurrency(p.price)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        <div>{formatCurrency(totalVal)}</div>
                        {p.profitMargin !== undefined && (
                          <span
                            className={`margin-badge ${
                              p.profitMargin >= 40
                                ? "high"
                                : p.profitMargin >= 20
                                ? "medium"
                                : "low"
                            }`}
                          >
                            {p.profitMargin}% margin
                          </span>
                        )}
                      </td>
                      <td>
                        {isOut ? (
                          <Badge variant="danger">Out of Stock</Badge>
                        ) : isLow ? (
                          <Badge variant="warning">Low Stock</Badge>
                        ) : (
                          <Badge variant="success">In Stock</Badge>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons-group">
                          <button
                            className="btn-action-icon"
                            title="Barcode Asset Tag"
                            onClick={() => openBarcodeModal(p)}
                          >
                            <Icons.Box />
                          </button>
                          <button
                            className="btn-action-icon"
                            title="Adjust Stock"
                            onClick={() => openStockModal(p)}
                          >
                            <Icons.ArrowUpDown />
                          </button>
                          <button
                            className="btn-action-icon"
                            title="Edit Product"
                            onClick={() => openEditModal(p)}
                          >
                            <Icons.Edit />
                          </button>
                          <button
                            className="btn-action-icon danger"
                            title="Delete Product"
                            onClick={() => openDeleteDialog(p)}
                          >
                            <Icons.Trash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* CARD GRID VIEW */
        <div className="products-card-grid">
          {filteredProducts.map((p) => {
            const isOut = p.quantity <= 0;
            const isLow = !isOut && p.quantity <= p.lowStockThreshold;
            const totalVal = (p.quantity || 0) * (p.price || 0);
            const isSelected = selectedIds.includes(p._id);

            return (
              <Card
                key={p._id}
                className={`product-card ${isOut ? "card-out" : isLow ? "card-low" : ""} ${
                  isSelected ? "card-selected" : ""
                }`}
              >
                <div className="product-card-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      className="custom-checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(p._id)}
                    />
                    <span className="category-tag">{p.category}</span>
                  </div>
                  {isOut ? (
                    <Badge variant="danger">Out of Stock</Badge>
                  ) : isLow ? (
                    <Badge variant="warning">Low Stock</Badge>
                  ) : (
                    <Badge variant="success">In Stock</Badge>
                  )}
                </div>

                <h3 className="product-card-title">{p.name}</h3>
                <div>
                  <button
                    className="sku-button"
                    onClick={() => openBarcodeModal(p)}
                    title="View Asset Barcode"
                  >
                    <code className="sku-badge">{p.sku}</code>
                    <span className="sku-tag-icon">🏷️</span>
                  </button>
                </div>

                <div className="product-card-metrics">
                  <div className="metric-box">
                    <span className="metric-label">Quantity</span>
                    <span
                      className={`metric-val ${
                        isOut ? "qty-out" : isLow ? "qty-low" : ""
                      }`}
                    >
                      {p.quantity} <small>/{p.lowStockThreshold}</small>
                    </span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Price</span>
                    <span className="metric-val">{formatCurrency(p.price)}</span>
                  </div>
                  <div className="metric-box full">
                    <span className="metric-label">Total Stock Value</span>
                    <span className="metric-val accent">
                      {formatCurrency(totalVal)}
                    </span>
                  </div>
                </div>

                <div className="product-card-footer">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Icons.ArrowUpDown}
                    onClick={() => openStockModal(p)}
                  >
                    Adjust Stock
                  </Button>
                  <div className="footer-icons">
                    <button
                      className="btn-action-icon"
                      onClick={() => openBarcodeModal(p)}
                      title="Barcode Tag"
                    >
                      <Icons.Box />
                    </button>
                    <button
                      className="btn-action-icon"
                      onClick={() => openEditModal(p)}
                      title="Edit"
                    >
                      <Icons.Edit />
                    </button>
                    <button
                      className="btn-action-icon danger"
                      onClick={() => openDeleteDialog(p)}
                      title="Delete"
                    >
                      <Icons.Trash2 />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* BARCODE ASSET TAG MODAL (UI EXTENSION) */}
      <BarcodeModal
        product={currentProduct}
        isOpen={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
      />

      {/* ADD PRODUCT MODAL */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New Product"
      >
        <form onSubmit={handleCreateProduct}>
          <Input
            label="Product Name"
            placeholder="e.g. Ergonomic Keyboard"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="form-grid-2">
            <Input
              label="SKU Code"
              placeholder="e.g. KB-001"
              value={formData.sku}
              onChange={(e) =>
                setFormData({ ...formData, sku: e.target.value.toUpperCase() })
              }
              required
            />
            <Input
              label="Category"
              placeholder="e.g. Electronics"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              required
            />
          </div>
          <div className="form-grid-3">
            <Input
              label="Initial Quantity"
              type="number"
              min="0"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  quantity: parseInt(e.target.value, 10) || 0,
                })
              }
              required
            />
            <Input
              label="Unit Price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  price: parseFloat(e.target.value) || 0,
                })
              }
              required
            />
            <Input
              label="Alert Threshold"
              type="number"
              min="0"
              value={formData.lowStockThreshold}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  lowStockThreshold: parseInt(e.target.value, 10) || 0,
                })
              }
              required
            />
          </div>

          <div className="modal-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Create Product
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT PRODUCT MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Product"
      >
        <form onSubmit={handleUpdateProduct}>
          <Input
            label="Product Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="form-grid-2">
            <Input
              label="SKU Code"
              value={formData.sku}
              onChange={(e) =>
                setFormData({ ...formData, sku: e.target.value.toUpperCase() })
              }
              required
            />
            <Input
              label="Category"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              required
            />
          </div>
          <div className="form-grid-3">
            <Input
              label="Current Quantity"
              type="number"
              min="0"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  quantity: parseInt(e.target.value, 10) || 0,
                })
              }
              required
            />
            <Input
              label="Unit Price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  price: parseFloat(e.target.value) || 0,
                })
              }
              required
            />
            <Input
              label="Alert Threshold"
              type="number"
              min="0"
              value={formData.lowStockThreshold}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  lowStockThreshold: parseInt(e.target.value, 10) || 0,
                })
              }
              required
            />
          </div>

          <div className="modal-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* QUICK STOCK ADJUSTMENT MODAL */}
      <Modal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        title={`Adjust Stock — ${currentProduct?.name || ""}`}
      >
        <form onSubmit={handleAdjustStock}>
          <div className="stock-modal-info">
            <span>
              Current Balance: <strong>{currentProduct?.quantity} units</strong>
            </span>
            <span>SKU: {currentProduct?.sku}</span>
          </div>

          <div className="action-toggle-row">
            <button
              type="button"
              className={`toggle-btn in ${
                stockForm.actionType === "in" ? "active" : ""
              }`}
              onClick={() => setStockForm({ ...stockForm, actionType: "in" })}
            >
              <Icons.ArrowDownLeft /> Stock In (Add)
            </button>
            <button
              type="button"
              className={`toggle-btn out ${
                stockForm.actionType === "out" ? "active" : ""
              }`}
              onClick={() => setStockForm({ ...stockForm, actionType: "out" })}
            >
              <Icons.ArrowUpRight /> Stock Out (Remove)
            </button>
          </div>

          <Input
            label="Quantity Units"
            type="number"
            min="1"
            value={stockForm.delta}
            onChange={(e) =>
              setStockForm({
                ...stockForm,
                delta: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            required
          />

          <Input
            label="Reason for Adjustment"
            placeholder={
              stockForm.actionType === "in"
                ? "e.g. Supplier Shipment, Restock"
                : "e.g. Customer Sale, Damaged Item"
            }
            value={stockForm.reason}
            onChange={(e) =>
              setStockForm({ ...stockForm, reason: e.target.value })
            }
            required
          />

          <div className="modal-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStockModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={stockForm.actionType === "in" ? "primary" : "danger"}
              loading={submitting}
            >
              Confirm {stockForm.actionType === "in" ? "Stock In" : "Stock Out"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteProduct}
        title="Delete Product"
        message={`Are you sure you want to permanently delete "${currentProduct?.name}" (SKU: ${currentProduct?.sku})? This will also remove associated stock movements.`}
        confirmText="Delete Product"
        confirmVariant="danger"
        loading={submitting}
      />

      {/* SLIDE-OUT PRODUCT DETAILS DRAWER (INSPECTOR WORKSPACE) */}
      {drawerProduct && (
        <div className="drawer-overlay" onClick={() => setDrawerProduct(null)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title-group">
                <div className="drawer-avatar">
                  {getCategoryEmoji(drawerProduct.category)}
                </div>
                <div>
                  <h3 className="drawer-title">{drawerProduct.name}</h3>
                  <span className="drawer-sku">SKU: {drawerProduct.sku}</span>
                </div>
              </div>
              <button
                className="drawer-close"
                onClick={() => setDrawerProduct(null)}
                title="Close drawer"
              >
                <Icons.X />
              </button>
            </div>

            <div className="drawer-body">
              {/* Stock Health Section */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <span>Inventory Level</span>
                  {drawerProduct.quantity <= 0 ? (
                    <Badge variant="danger">Out of Stock</Badge>
                  ) : drawerProduct.quantity <= drawerProduct.lowStockThreshold ? (
                    <Badge variant="warning">Low Stock</Badge>
                  ) : (
                    <Badge variant="success">In Stock</Badge>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 800 }}>
                    {drawerProduct.quantity}{" "}
                    <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      units available
                    </span>
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                    Threshold: {drawerProduct.lowStockThreshold} units
                  </span>
                </div>

                {/* Stock capacity bar */}
                <div
                  style={{
                    height: "8px",
                    background: "var(--bg-app)",
                    borderRadius: "99px",
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(5, (drawerProduct.quantity / (drawerProduct.lowStockThreshold * 3)) * 100))}%`,
                      background:
                        drawerProduct.quantity <= 0
                          ? "#ef4444"
                          : drawerProduct.quantity <= drawerProduct.lowStockThreshold
                          ? "#f59e0b"
                          : "var(--accent)",
                      transition: "width 300ms ease",
                    }}
                  />
                </div>

                {/* Quick 1-Click Stepper */}
                <div style={{ marginTop: "0.5rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                    Quick Restock / Dispatch (1-Click)
                  </div>
                  <div className="stepper-row">
                    <button
                      className="btn-stepper negative"
                      onClick={() => handleQuickInlineAdjust(drawerProduct, -5)}
                      disabled={drawerProduct.quantity < 5}
                    >
                      -5
                    </button>
                    <button
                      className="btn-stepper negative"
                      onClick={() => handleQuickInlineAdjust(drawerProduct, -1)}
                      disabled={drawerProduct.quantity <= 0}
                    >
                      -1
                    </button>
                    <button
                      className="btn-stepper"
                      onClick={() => handleQuickInlineAdjust(drawerProduct, 1)}
                    >
                      +1
                    </button>
                    <button
                      className="btn-stepper"
                      onClick={() => handleQuickInlineAdjust(drawerProduct, 5)}
                    >
                      +5
                    </button>
                    <button
                      className="btn-stepper"
                      onClick={() => handleQuickInlineAdjust(drawerProduct, 25)}
                    >
                      +25
                    </button>
                  </div>
                </div>
              </div>

              {/* Financial Economics Section */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <span>Unit Economics & Valuation</span>
                  {drawerProduct.profitMargin !== undefined && (
                    <span
                      className={`margin-badge ${
                        drawerProduct.profitMargin >= 40
                          ? "high"
                          : drawerProduct.profitMargin >= 20
                          ? "medium"
                          : "low"
                      }`}
                    >
                      {drawerProduct.profitMargin}% Margin
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Selling Price</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                      {formatCurrency(drawerProduct.price)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Cost Price</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-muted)" }}>
                      {formatCurrency(drawerProduct.costPrice || drawerProduct.price * 0.6)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Profit per Unit</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)" }}>
                      {formatCurrency(
                        Math.max(
                          0,
                          drawerProduct.price - (drawerProduct.costPrice || drawerProduct.price * 0.6)
                        )
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Total Stock Value</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>
                      {formatCurrency((drawerProduct.quantity || 0) * (drawerProduct.price || 0))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Location & Supply Chain */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <span>Warehouse & Supply Chain</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Warehouse Hub:</span>
                    <strong style={{ color: "var(--text-main)" }}>
                      {drawerProduct.warehouse || "Main Hub (Bengaluru)"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Storage Bin:</span>
                    <strong style={{ color: "var(--text-main)" }}>
                      {drawerProduct.location || "Aisle 3, Rack A2"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Supplier:</span>
                    <strong style={{ color: "var(--text-main)" }}>
                      {drawerProduct.supplier || "Logitech Systems India"}
                    </strong>
                  </div>
                  {drawerProduct.batchNumber && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Batch No:</span>
                      <code>{drawerProduct.batchNumber}</code>
                    </div>
                  )}
                </div>
              </div>

              {/* Barcode Tag Preview & Print */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <span>Asset Tag & Barcode</span>
                  <button
                    className="clear-all-link"
                    onClick={() => {
                      openBarcodeModal(drawerProduct);
                    }}
                  >
                    Print Label 🏷️
                  </button>
                </div>
                <div
                  style={{
                    background: "#ffffff",
                    color: "#000000",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.1em" }}>
                    {drawerProduct.barcode || drawerProduct.sku}
                  </span>
                  <svg viewBox="0 0 100 24" width="100%" height="36" preserveAspectRatio="none">
                    <rect x="2" y="0" width="3" height="24" fill="#000" />
                    <rect x="8" y="0" width="2" height="24" fill="#000" />
                    <rect x="13" y="0" width="5" height="24" fill="#000" />
                    <rect x="22" y="0" width="2" height="24" fill="#000" />
                    <rect x="27" y="0" width="4" height="24" fill="#000" />
                    <rect x="35" y="0" width="2" height="24" fill="#000" />
                    <rect x="40" y="0" width="6" height="24" fill="#000" />
                    <rect x="49" y="0" width="3" height="24" fill="#000" />
                    <rect x="56" y="0" width="2" height="24" fill="#000" />
                    <rect x="61" y="0" width="5" height="24" fill="#000" />
                    <rect x="70" y="0" width="4" height="24" fill="#000" />
                    <rect x="78" y="0" width="2" height="24" fill="#000" />
                    <rect x="84" y="0" width="4" height="24" fill="#000" />
                    <rect x="92" y="0" width="3" height="24" fill="#000" />
                  </svg>
                </div>
              </div>

              {/* Movement History Stream */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <span>Recent Audit Movements</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                    {productMovements.length} logged
                  </span>
                </div>
                {productMovements.length === 0 ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", textAlign: "center", padding: "0.5rem" }}>
                    No audit movements recorded for this item yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {productMovements.map((m) => (
                      <div
                        key={m._id || m.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.8rem",
                          padding: "0.35rem 0.5rem",
                          background: "var(--bg-card)",
                          borderRadius: "4px",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)" }}>{m.reason}</span>
                        <strong style={{ color: m.delta > 0 ? "var(--accent)" : "#ef4444" }}>
                          {m.delta > 0 ? `+${m.delta}` : m.delta}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drawer Action Buttons */}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "auto" }}>
                <Button
                  variant="secondary"
                  icon={Icons.ArrowUpDown}
                  style={{ flex: 1 }}
                  onClick={() => {
                    openStockModal(drawerProduct);
                  }}
                >
                  Adjust Stock
                </Button>
                <Button
                  variant="primary"
                  icon={Icons.Edit}
                  style={{ flex: 1 }}
                  onClick={() => {
                    openEditModal(drawerProduct);
                  }}
                >
                  Edit Details
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BARCODE SCANNER SIMULATION MODAL */}
      <Modal
        isOpen={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        title="Live Barcode & SKU Asset Scanner"
      >
        <div className="scanner-modal-body">
          <div className="scanner-viewfinder">
            <div className="scanner-laser" />
            <div className="scanner-target-reticle">
              ALIGN BARCODE
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleScanSubmit();
            }}
            style={{ width: "100%", display: "flex", gap: "0.5rem" }}
          >
            <Input
              placeholder="Scan barcode or enter SKU (e.g. KB-MECH-01)..."
              value={scannerInput}
              onChange={(e) => setScannerInput(e.target.value)}
              autoFocus
              style={{ flex: 1, margin: 0 }}
            />
            <Button type="submit" variant="primary" icon={Icons.Check}>
              Scan
            </Button>
          </form>

          <div style={{ width: "100%" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
              Quick Test Barcodes (Click to simulate laser scan):
            </div>
            <div className="quick-barcodes-list">
              {products.slice(0, 6).map((p) => (
                <button
                  key={p._id}
                  className="btn-quick-barcode"
                  type="button"
                  onClick={() => handleScanSubmit(p.barcode || p.sku)}
                >
                  ⚡ {p.sku} ({p.name.slice(0, 18)}...)
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
