import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../utils/supabase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState("admin"); // 'admin' | 'manager' | 'staff'
  const [organization, setOrganization] = useState({
    id: "00000000-0000-0000-0000-000000000001",
    name: "Acme Logistics Enterprise",
    slug: "acme-logistics",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check active Supabase Auth session
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await loadUserProfile(session.user);
        } else {
          // Check for saved local demo profile or default to demo admin
          const savedRole = localStorage.getItem("inventra_user_role") || "admin";
          const savedName = localStorage.getItem("inventra_user_name") || "Vedant Mhatre (Admin)";
          setRole(savedRole);
          setUser({
            id: "demo-user-id",
            email: "vedant@inventra.cloud",
            user_metadata: { full_name: savedName },
          });
          setProfile({
            full_name: savedName,
            role: savedRole,
            email: "vedant@inventra.cloud",
          });
        }
      } catch (err) {
        console.warn("Auth initialization notice:", err.message);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    // 2. Listen to Supabase Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadUserProfile(session.user);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  async function loadUserProfile(authUser) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
        if (data.role) setRole(data.role);
      } else {
        const defaultRole = authUser.user_metadata?.role || "admin";
        setRole(defaultRole);
        setProfile({
          full_name: authUser.user_metadata?.full_name || authUser.email.split("@")[0],
          role: defaultRole,
          email: authUser.email,
        });
      }
    } catch {
      // Fallback
    }
  }

  // Sign In with Supabase Auth
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data?.user) {
      setUser(data.user);
      await loadUserProfile(data.user);
    }
    return data;
  }

  // Sign Up with Supabase Auth
  async function signUp(email, password, fullName, selectedRole = "staff") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: selectedRole,
        },
      },
    });
    if (error) throw error;
    return data;
  }

  // Sign Out
  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore if offline
    }
    setUser(null);
    setProfile(null);
    setRole("staff");
    localStorage.removeItem("inventra_user_role");
  }

  // Quick switch role (for testing RBAC: Admin vs Manager vs Staff)
  function switchRole(newRole, name) {
    setRole(newRole);
    localStorage.setItem("inventra_user_role", newRole);
    if (name) localStorage.setItem("inventra_user_name", name);
    setUser((prev) => ({
      ...prev,
      user_metadata: { ...prev?.user_metadata, full_name: name || prev?.user_metadata?.full_name },
    }));
    setProfile((prev) => ({
      ...prev,
      role: newRole,
      full_name: name || prev?.full_name,
    }));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        organization,
        loading,
        signIn,
        signUp,
        signOut,
        switchRole,
        isAdmin: role === "admin",
        isManager: role === "manager" || role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
