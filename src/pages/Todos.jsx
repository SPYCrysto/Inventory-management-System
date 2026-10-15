import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { checkStorageHealth, uploadInventoryAsset, listInventoryAssets } from "../utils/storage";
import { Card, Button, Input, Badge, Icons } from "../ui.jsx";

export default function Todos() {
  const [activeTab, setActiveTab] = useState("database"); // 'database' | 'storage'

  // Database Tab States
  const [todos, setTodos] = useState([]);
  const [newTodoName, setNewTodoName] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [adding, setAdding] = useState(false);

  // Storage Tab States
  const [storageStatus, setStorageStatus] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  async function fetchTodos() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.from("todos").select();
      if (error) {
        setErrorMsg(error.message || "Failed to fetch from Supabase");
      } else if (data) {
        setTodos(data);
      }
    } catch (err) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function checkStorage() {
    setStorageLoading(true);
    setUploadError(null);
    try {
      const res = await checkStorageHealth();
      setStorageStatus(res);
      if (res.hasBucket) {
        const { files } = await listInventoryAssets();
        setUploadedFiles(files);
      }
    } catch (err) {
      setStorageStatus({ status: "error", message: err.message, buckets: [] });
    } finally {
      setStorageLoading(false);
    }
  }

  useEffect(() => {
    fetchTodos();
    checkStorage();
  }, []);

  async function handleAddTodo(e) {
    e.preventDefault();
    if (!newTodoName.trim()) return;

    setAdding(true);
    try {
      const { data, error } = await supabase
        .from("todos")
        .insert([{ name: newTodoName.trim() }])
        .select();

      if (error) {
        alert("Supabase error: " + error.message);
      } else {
        setNewTodoName("");
        if (data && data.length > 0) {
          setTodos((prev) => [...prev, ...data]);
        } else {
          fetchTodos();
        }
      }
    } catch (err) {
      alert("Error adding todo: " + err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteTodo(id) {
    try {
      const { error } = await supabase.from("todos").delete().eq("id", id);
      if (error) {
        alert("Failed to delete: " + error.message);
      } else {
        setTodos((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadSuccess(null);
    setUploadError(null);
    try {
      const result = await uploadInventoryAsset(file, "uploads");
      setUploadSuccess(`Uploaded "${file.name}" successfully! URL: ${result.url}`);
      checkStorage();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Supabase Cloud & Storage Center</h1>
          <p className="page-subtitle">
            Diagnostics, PostgreSQL database queries, and Supabase Storage asset verification (
            <code style={{ fontSize: "12px", background: "var(--bg-card)", padding: "2px 6px", borderRadius: "4px" }}>
              hkzsfibpixlqeumakrld.supabase.co
            </code>
            )
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant="outline"
            icon={Icons.RefreshCw}
            onClick={() => {
              if (activeTab === "database") fetchTodos();
              else checkStorage();
            }}
            disabled={loading || storageLoading}
          >
            {loading || storageLoading ? "Syncing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("database")}
          className={`category-pill ${activeTab === "database" ? "active" : ""}`}
          style={{ cursor: "pointer", padding: "8px 16px" }}
        >
          🗄️ Database & Sync ({todos.length})
        </button>
        <button
          onClick={() => setActiveTab("storage")}
          className={`category-pill ${activeTab === "storage" ? "active" : ""}`}
          style={{ cursor: "pointer", padding: "8px 16px" }}
        >
          📦 Cloud Storage Bucket ({storageStatus?.hasBucket ? "Online" : "Needs Setup"})
        </button>
      </div>

      {/* TAB 1: DATABASE SYNC */}
      {activeTab === "database" && (
        <>
          {errorMsg && (
            <div
              style={{
                padding: "16px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                marginBottom: "20px",
                color: "var(--text-primary)",
              }}
            >
              <div style={{ fontWeight: 600, color: "#ef4444", marginBottom: "4px" }}>
                Supabase Notice:
              </div>
              <div>{errorMsg}</div>
              <div style={{ fontSize: "13px", marginTop: "8px", opacity: 0.85 }}>
                Note: If you haven't created the <code>todos</code> table in your Supabase SQL editor yet, run:
                <pre
                  style={{
                    marginTop: "8px",
                    padding: "10px",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "6px",
                    overflowX: "auto",
                  }}
                >
                  CREATE TABLE todos (id bigint generated by default as identity primary key, name text);
                </pre>
              </div>
            </div>
          )}

          <Card title="Add Item to Supabase">
            <form onSubmit={handleAddTodo} style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="e.g., Weekly stock audit, Restock raw materials..."
                  value={newTodoName}
                  onChange={(e) => setNewTodoName(e.target.value)}
                />
              </div>
              <Button variant="primary" type="submit" disabled={adding || !newTodoName.trim()} icon={Icons.Plus}>
                {adding ? "Saving..." : "Add to Supabase"}
              </Button>
            </form>
          </Card>

          <div style={{ marginTop: "24px" }}>
            <Card title={`Live Todos Table (${todos.length} items in Supabase)`}>
              {loading ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-secondary)" }}>
                  Fetching data from Supabase...
                </div>
              ) : todos.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
                  <p>No todos found in your Supabase database table.</p>
                  <span style={{ fontSize: "13px", opacity: 0.7 }}>Add one using the input form above.</span>
                </div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                  {todos.map((todo) => (
                    <li
                      key={todo.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        background: "var(--bg-input)",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <Badge variant="primary">#{todo.id}</Badge>
                        <span style={{ fontWeight: 500 }}>{todo.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Icons.Trash2}
                        onClick={() => handleDeleteTodo(todo.id)}
                        title="Delete item"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      {/* TAB 2: CLOUD STORAGE */}
      {activeTab === "storage" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Storage Bucket Status Card */}
          <Card title="Supabase Storage Bucket: inventory-assets">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "18px" }}>
                    {storageStatus?.hasBucket ? "🟢" : "🟡"}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: "16px" }}>
                    {storageStatus?.hasBucket ? "Bucket 'inventory-assets' is Active" : "Bucket 'inventory-assets' Requires SQL Provisioning"}
                  </span>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
                  Used for product photo uploads, supplier invoices, and asset barcodes.
                </p>
              </div>
              <Badge variant={storageStatus?.hasBucket ? "success" : "warning"}>
                {storageStatus?.hasBucket ? "Public Storage Online" : "Action Required"}
              </Badge>
            </div>

            {/* Test File Upload Form */}
            <div style={{ marginTop: "20px", padding: "16px", background: "var(--bg-surface)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>Upload Test File to Supabase Storage:</h4>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                style={{ fontSize: "13px" }}
              />
              {uploading && <span style={{ marginLeft: "12px", fontSize: "13px" }}>Uploading to Supabase Storage...</span>}

              {uploadSuccess && (
                <div style={{ marginTop: "12px", padding: "10px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", borderRadius: "6px", fontSize: "13px" }}>
                  {uploadSuccess}
                </div>
              )}

              {uploadError && (
                <div style={{ marginTop: "12px", padding: "10px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", borderRadius: "6px", fontSize: "13px" }}>
                  {uploadError}
                </div>
              )}
            </div>

            {/* Setup Instructions if bucket not yet created in Supabase */}
            {!storageStatus?.hasBucket && (
              <div style={{ marginTop: "20px", padding: "16px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "8px" }}>
                <div style={{ fontWeight: 700, color: "#f59e0b", marginBottom: "6px" }}>
                  How to Enable Supabase Storage in 1 Step:
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-main)", margin: "0 0 8px 0" }}>
                  Supabase requires storage buckets and RLS policies to be created via the dashboard SQL editor:
                </p>
                <pre style={{ padding: "12px", background: "rgba(0,0,0,0.4)", borderRadius: "6px", fontSize: "12px", overflowX: "auto" }}>
{`-- Paste this in your Supabase SQL Editor (supabase.com/dashboard):
INSERT INTO storage.buckets (id, name, public) VALUES ('inventory-assets', 'inventory-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'inventory-assets');
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'inventory-assets');
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'inventory-assets');
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'inventory-assets');`}
                </pre>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
