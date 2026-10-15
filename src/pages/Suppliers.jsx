import React, { useEffect, useState, useMemo } from "react";
import { inventoryApi } from "../api.js";
import { useToast } from "../toast.jsx";
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

const EMPTY_SUPPLIER = {
  name: "",
  code: "",
  contactPerson: "",
  email: "",
  phone: "",
  gstin: "",
  city: "Mumbai",
  paymentTerms: "Net 30",
};

const PAYMENT_TERMS = [
  { value: "Net 15", label: "Net 15 Days" },
  { value: "Net 30", label: "Net 30 Days" },
  { value: "Net 45", label: "Net 45 Days" },
  { value: "Net 60", label: "Net 60 Days" },
  { value: "Prepaid", label: "Prepaid (Advance)" },
  { value: "COD", label: "Cash on Delivery" },
];

export default function Suppliers() {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_SUPPLIER);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const data = await inventoryApi.getSuppliers();
      setSuppliers(data);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const term = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.code.toLowerCase().includes(term) ||
        s.city?.toLowerCase().includes(term) ||
        s.contactPerson?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term)
    );
  }, [suppliers, search]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      showToast("Supplier name and code are required", "warning");
      return;
    }
    try {
      setSaving(true);
      await inventoryApi.createSupplier(form);
      showToast(`Supplier "${form.name}" created successfully`, "success");
      setModalOpen(false);
      setForm(EMPTY_SUPPLIER);
      await fetchSuppliers();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await inventoryApi.deleteSupplier(deleteTarget._id);
      showToast(`Supplier "${deleteTarget.name}" deleted`, "success");
      setDeleteTarget(null);
      await fetchSuppliers();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleSeed = async () => {
    try {
      setSeeding(true);
      await inventoryApi.seedSuppliers(false);
      showToast("Sample suppliers seeded!", "success");
      await fetchSuppliers();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSeeding(false);
    }
  };

  if (loading && suppliers.length === 0) {
    return (
      <div className="page-loading">
        <span className="spinner large" />
        <p>Loading suppliers...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Supplier Management</h1>
          <p className="page-subtitle">
            Manage your vendor directory, contacts, and payment terms
          </p>
        </div>
        <div className="header-actions">
          <Button variant="ghost" icon={Icons.RefreshCw} onClick={fetchSuppliers} loading={loading}>
            Refresh
          </Button>
          <Button
            variant="primary"
            icon={Icons.Plus}
            onClick={() => {
              setForm(EMPTY_SUPPLIER);
              setModalOpen(true);
            }}
          >
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Supplier Stats Bar */}
      <div className="supplier-stats-bar">
        <div className="supplier-stat-chip">
          <Icons.Users className="chip-icon" />
          <span className="chip-label">Total</span>
          <span className="chip-value">{suppliers.length}</span>
        </div>
        <div className="supplier-stat-chip active">
          <Icons.Check className="chip-icon" />
          <span className="chip-label">Active</span>
          <span className="chip-value">
            {suppliers.filter((s) => s.status !== "inactive").length}
          </span>
        </div>
        <div className="supplier-stat-chip">
          <Icons.MapPin className="chip-icon" />
          <span className="chip-label">Cities</span>
          <span className="chip-value">
            {new Set(suppliers.map((s) => s.city).filter(Boolean)).size}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="filter-toolbar">
        <div className="search-box">
          <Icons.Search />
          <input
            type="text"
            placeholder="Search suppliers by name, code, city, or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Empty State */}
      {suppliers.length === 0 ? (
        <Card className="seed-banner">
          <div className="seed-banner-content">
            <div className="seed-icon">
              <Icons.Users />
            </div>
            <div>
              <h3>No suppliers yet</h3>
              <p>
                Add your first supplier or generate sample data to explore the
                supplier management features.
              </p>
            </div>
          </div>
          <Button
            variant="accent"
            icon={Icons.Sparkles}
            onClick={handleSeed}
            loading={seeding}
          >
            Seed Sample Suppliers
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Icons.Search}
          title="No matching suppliers"
          description={`No suppliers match "${search}". Try a different search term.`}
        />
      ) : (
        /* Supplier Cards Grid */
        <div className="supplier-grid">
          {filtered.map((supplier) => {
            const isExpanded = expandedId === supplier._id;
            return (
              <Card key={supplier._id} className="supplier-card">
                <div className="supplier-card-top">
                  <div className="supplier-identity">
                    <div className="supplier-avatar">
                      {supplier.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="supplier-name-group">
                      <h3 className="supplier-name">{supplier.name}</h3>
                      <span className="supplier-code">{supplier.code}</span>
                    </div>
                  </div>
                  <div className="supplier-card-actions">
                    <Badge variant={supplier.status === "inactive" ? "danger" : "success"} size="sm">
                      {supplier.status === "inactive" ? "Inactive" : "Active"}
                    </Badge>
                    <button
                      className="btn-icon-close"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : supplier._id)
                      }
                      title={isExpanded ? "Collapse" : "Show Details"}
                    >
                      {isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
                    </button>
                  </div>
                </div>

                {/* Quick Info Row */}
                <div className="supplier-quick-info">
                  {supplier.city && (
                    <span className="supplier-info-tag">
                      <Icons.MapPin /> {supplier.city}
                    </span>
                  )}
                  {supplier.paymentTerms && (
                    <span className="supplier-info-tag">
                      <Icons.CreditCard /> {supplier.paymentTerms}
                    </span>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="supplier-details">
                    {supplier.contactPerson && (
                      <div className="detail-row">
                        <Icons.Users className="detail-icon" />
                        <span className="detail-label">Contact</span>
                        <span className="detail-value">{supplier.contactPerson}</span>
                      </div>
                    )}
                    {supplier.email && (
                      <div className="detail-row">
                        <Icons.Mail className="detail-icon" />
                        <span className="detail-label">Email</span>
                        <a href={`mailto:${supplier.email}`} className="detail-value detail-link">
                          {supplier.email}
                        </a>
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="detail-row">
                        <Icons.Phone className="detail-icon" />
                        <span className="detail-label">Phone</span>
                        <a href={`tel:${supplier.phone}`} className="detail-value detail-link">
                          {supplier.phone}
                        </a>
                      </div>
                    )}
                    {supplier.gstin && (
                      <div className="detail-row">
                        <Icons.Hash className="detail-icon" />
                        <span className="detail-label">GSTIN</span>
                        <span className="detail-value mono">{supplier.gstin}</span>
                      </div>
                    )}
                    <div className="supplier-detail-actions">
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Icons.Trash2}
                        onClick={() => setDeleteTarget(supplier)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Supplier Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add New Supplier"
        maxWidth="560px"
      >
        <form onSubmit={handleCreate} className="modal-form">
          <div className="form-grid-2">
            <Input
              label="Supplier Name *"
              placeholder="e.g. Acme Electronics"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Supplier Code *"
              placeholder="e.g. SUP-ACME-01"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
            />
          </div>
          <div className="form-grid-2">
            <Input
              label="Contact Person"
              placeholder="Full name"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              placeholder="vendor@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-grid-2">
            <Input
              label="Phone"
              type="tel"
              placeholder="+91 98200 12345"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="City"
              placeholder="Mumbai"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div className="form-grid-2">
            <Input
              label="GSTIN"
              placeholder="22AAAAA0000A1Z5"
              value={form.gstin}
              onChange={(e) =>
                setForm({ ...form, gstin: e.target.value.toUpperCase() })
              }
            />
            <Select
              label="Payment Terms"
              options={PAYMENT_TERMS}
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={saving}>
              Create Supplier
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Supplier?"
        message={`Are you sure you want to remove "${deleteTarget?.name}" (${deleteTarget?.code})? This action cannot be undone.`}
        confirmText="Delete Supplier"
        loading={deleting}
      />
    </div>
  );
}
