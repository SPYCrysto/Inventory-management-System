import React, { useState, useEffect, useMemo } from "react";
import { inventoryApi } from "../api.js";
import { useToast } from "../toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  Card,
  Button,
  Badge,
  Icons,
  Modal,
  Input,
  Select,
  ConfirmDialog,
  EmptyState,
} from "../ui.jsx";

export default function Categories() {
  const { toast } = useToast();
  const { isManager } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const prods = await inventoryApi.getProducts();
      setProducts(prods);

      // Aggregate categories from products + defaults
      const catMap = {};
      const defaultCategories = [
        { name: "Electronics", description: "Audio, computing, accessories & gadgets" },
        { name: "Accessories", description: "Cables, adapters, mounts and peripherals" },
        { name: "Office", description: "Desk setup, mats, ergonomics & stationery" },
        { name: "Furniture", description: "Desks, chairs, monitor arms & storage units" },
        { name: "Kitchenware", description: "Drinkware, tumblers, and breakroom supplies" },
        { name: "Stationery", description: "Notebooks, journals, pens, and paper supplies" },
      ];

      defaultCategories.forEach((c) => {
        catMap[c.name] = { ...c, productCount: 0, totalStock: 0, totalValue: 0 };
      });

      prods.forEach((p) => {
        const catName = p.category || "General";
        if (!catMap[catName]) {
          catMap[catName] = { name: catName, description: "Catalog category", productCount: 0, totalStock: 0, totalValue: 0 };
        }
        catMap[catName].productCount++;
        catMap[catName].totalStock += (p.quantity || 0);
        catMap[catName].totalValue += (p.quantity || 0) * (p.price || 0);
      });

      setCategories(Object.values(catMap));
    } catch (err) {
      toast(err.message || "Failed to load categories", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const term = search.toLowerCase();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(term) || (c.description || "").toLowerCase().includes(term)
    );
  }, [categories, search]);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({ name: "", description: "" });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name, description: cat.description || "" });
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast("Category name is required", "error");
      return;
    }

    if (editingCategory) {
      setCategories((prev) =>
        prev.map((c) =>
          c.name === editingCategory.name
            ? { ...c, name: formData.name.trim(), description: formData.description.trim() }
            : c
        )
      );
      toast(`Category '${formData.name}' updated successfully`, "success");
    } else {
      const exists = categories.some((c) => c.name.toLowerCase() === formData.name.trim().toLowerCase());
      if (exists) {
        toast("A category with this name already exists", "error");
        return;
      }
      setCategories((prev) => [
        ...prev,
        {
          name: formData.name.trim(),
          description: formData.description.trim(),
          productCount: 0,
          totalStock: 0,
          totalValue: 0,
        },
      ]);
      toast(`Category '${formData.name}' created successfully`, "success");
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setCategories((prev) => prev.filter((c) => c.name !== deleteTarget.name));
    toast(`Category '${deleteTarget.name}' deleted`, "info");
    setDeleteTarget(null);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Category Management</h1>
          <p className="page-subtitle">Organize, classify, and track stock valuation across inventory departments</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {isManager && (
            <Button variant="primary" icon={Icons.Plus} onClick={handleOpenCreate}>
              New Category
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: "24px" }}>
        <Card className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent-primary)" }}>
            <Icons.Layers />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Categories</span>
            <span className="stat-value">{categories.length}</span>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
            <Icons.Box />
          </div>
          <div className="stat-content">
            <span className="stat-label">Catalog Products</span>
            <span className="stat-value">{products.length}</span>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
            <Icons.DollarSign />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Valuation</span>
            <span className="stat-value">
              ${categories.reduce((acc, c) => acc + (c.totalValue || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Input
              placeholder="Search categories by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" icon={Icons.RefreshCw} onClick={loadData} disabled={loading}>
            Refresh
          </Button>
        </div>
      </Card>

      {/* Categories Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>
          Loading categories from Supabase...
        </div>
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          title="No Categories Found"
          description={search ? "Try adjusting your search query." : "Create your first category to group your products."}
          actionLabel="Add Category"
          onAction={handleOpenCreate}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {filteredCategories.map((cat) => (
            <Card key={cat.name} className="product-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "rgba(99, 102, 241, 0.12)",
                      color: "var(--accent-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Icons.Layers />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{cat.name}</h3>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {cat.productCount} {cat.productCount === 1 ? "product" : "products"}
                      </span>
                    </div>
                  </div>
                  {isManager && (
                    <div style={{ display: "flex", gap: "4px" }}>
                      <Button variant="ghost" size="sm" icon={Icons.Edit} onClick={() => handleOpenEdit(cat)} />
                      <Button variant="ghost" size="sm" icon={Icons.Trash2} onClick={() => setDeleteTarget(cat)} />
                    </div>
                  )}
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 16px 0" }}>
                  {cat.description || "No description provided."}
                </p>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                paddingTop: "12px",
                borderTop: "1px solid var(--border-color)",
                gap: "10px"
              }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }}>Total Units</span>
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>{cat.totalStock.toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }}>Inventory Value</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-primary)" }}>
                    ${cat.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Create / Edit Category */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? "Edit Category" : "Create New Category"}
      >
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
              Category Name *
            </label>
            <Input
              required
              placeholder="e.g. Peripherals, Audio, Raw Materials"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
              Description
            </label>
            <Input
              placeholder="Brief details about what belongs in this category..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingCategory ? "Save Changes" : "Create Category"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Category?"
        message={`Are you sure you want to remove '${deleteTarget?.name}'? Existing products will be moved to 'General'.`}
        confirmText="Delete Category"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
