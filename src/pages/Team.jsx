import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../toast.jsx";
import {
  Card,
  Button,
  Badge,
  Icons,
  Modal,
  Input,
  Select,
} from "../ui.jsx";

export default function Team() {
  const { user, profile, role, switchRole, organization, isAdmin } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState([
    {
      id: "usr-01",
      name: "Vedant Mhatre",
      email: "vedant@inventra.cloud",
      role: "admin",
      status: "Active",
      lastActive: "Just now",
    },
    {
      id: "usr-02",
      name: "Ananya Sharma",
      email: "ananya@inventra.cloud",
      role: "manager",
      status: "Active",
      lastActive: "2 hours ago",
    },
    {
      id: "usr-03",
      name: "Karan Patel",
      email: "karan@inventra.cloud",
      role: "staff",
      status: "Active",
      lastActive: "1 day ago",
    },
  ]);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    role: "staff",
  });

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.name) {
      toast("Name and email are required", "error");
      return;
    }

    const newMember = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: inviteForm.name.trim(),
      email: inviteForm.email.trim(),
      role: inviteForm.role,
      status: "Invited",
      lastActive: "Pending confirmation",
    };

    setMembers((prev) => [...prev, newMember]);
    toast(`Invitation sent to ${inviteForm.email} (${inviteForm.role.toUpperCase()})`, "success");
    setIsInviteModalOpen(false);
    setInviteForm({ name: "", email: "", role: "staff" });
  };

  const handleRoleChange = (memberId, newRole) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    toast("Role updated successfully", "info");
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team & Role-Based Access Control</h1>
          <p className="page-subtitle">
            Manage organization members, workspace access, and granular security roles (Admin, Manager, Staff)
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {isAdmin && (
            <Button variant="primary" icon={Icons.Users} onClick={() => setIsInviteModalOpen(true)}>
              Invite Member
            </Button>
          )}
        </div>
      </div>

      {/* Interactive Role Switcher for Developer / Evaluator Testing */}
      <Card style={{ marginBottom: "24px", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontWeight: 600, fontSize: "15px" }}>Current Active Role:</span>
              <Badge variant={role === "admin" ? "primary" : role === "manager" ? "warning" : "neutral"}>
                {role.toUpperCase()}
              </Badge>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
              Test how UI controls and permissions adapt based on the active role.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              variant={role === "admin" ? "primary" : "outline"}
              size="sm"
              onClick={() => switchRole("admin", "Vedant Mhatre (Admin)")}
            >
              Test as Admin
            </Button>
            <Button
              variant={role === "manager" ? "primary" : "outline"}
              size="sm"
              onClick={() => switchRole("manager", "Ananya Sharma (Manager)")}
            >
              Test as Manager
            </Button>
            <Button
              variant={role === "staff" ? "primary" : "outline"}
              size="sm"
              onClick={() => switchRole("staff", "Karan Patel (Staff)")}
            >
              Test as Staff
            </Button>
          </div>
        </div>
      </Card>

      {/* Permissions Matrix */}
      <Card title="Role Permissions Matrix" style={{ marginBottom: "24px" }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>System Capability</th>
                <th>Staff</th>
                <th>Manager</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>View Products, Stock & Catalog</td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
              </tr>
              <tr>
                <td>Stock-In / Stock-Out Operations</td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
              </tr>
              <tr>
                <td>Create / Edit / Import Products</td>
                <td><span style={{ color: "var(--text-secondary)" }}>✕ View Only</span></td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
              </tr>
              <tr>
                <td>Purchase Order Authorisation</td>
                <td><span style={{ color: "var(--text-secondary)" }}>✕ No Access</span></td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
              </tr>
              <tr>
                <td>Executive Valuation & Financial Reports</td>
                <td><span style={{ color: "var(--text-secondary)" }}>✕ Masked</span></td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
                <td><span style={{ color: "#10b981" }}>✓ Allowed</span></td>
              </tr>
              <tr>
                <td>Team Management & Workspace Settings</td>
                <td><span style={{ color: "var(--text-secondary)" }}>✕ No Access</span></td>
                <td><span style={{ color: "var(--text-secondary)" }}>✕ No Access</span></td>
                <td><span style={{ color: "#10b981" }}>✓ Full Access</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Team Members List */}
      <Card title={`Organization Members (${members.length})`}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Security Role</th>
                <th>Status</th>
                <th>Last Active</th>
                {isAdmin && <th style={{ textAlign: "right" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td>{m.email}</td>
                  <td>
                    {isAdmin && m.id !== "usr-01" ? (
                      <Select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        style={{ padding: "4px 8px", fontSize: "12px", width: "auto" }}
                      >
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </Select>
                    ) : (
                      <Badge variant={m.role === "admin" ? "primary" : m.role === "manager" ? "warning" : "neutral"}>
                        {m.role.toUpperCase()}
                      </Badge>
                    )}
                  </td>
                  <td>
                    <Badge variant={m.status === "Active" ? "success" : "neutral"}>
                      {m.status}
                    </Badge>
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{m.lastActive}</td>
                  {isAdmin && (
                    <td style={{ textAlign: "right" }}>
                      {m.id !== "usr-01" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Icons.Trash2}
                          onClick={() => {
                            setMembers((prev) => prev.filter((item) => item.id !== m.id));
                            toast(`Removed ${m.name}`, "info");
                          }}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Invite Member */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite Organization Member"
      >
        <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
              Full Name *
            </label>
            <Input
              required
              placeholder="e.g. Rahul Verma"
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
              Email Address *
            </label>
            <Input
              type="email"
              required
              placeholder="rahul@company.com"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
              Role Assignment *
            </label>
            <Select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
            >
              <option value="staff">Staff (Stock-in / Stock-out only)</option>
              <option value="manager">Manager (Product Catalog & POs)</option>
              <option value="admin">Admin (Full System & RBAC)</option>
            </Select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <Button variant="ghost" type="button" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" icon={Icons.Mail}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
