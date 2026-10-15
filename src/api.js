import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor to normalize error messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

export const inventoryApi = {
  // Products
  getProducts: (params = {}) => api.get("/products", { params }).then((r) => r.data),
  getProduct: (id) => api.get(`/products/${id}`).then((r) => r.data),
  createProduct: (data) => api.post("/products", data).then((r) => r.data),
  updateProduct: (id, data) => api.put(`/products/${id}`, data).then((r) => r.data),
  deleteProduct: (id) => api.delete(`/products/${id}`).then((r) => r.data),
  adjustStock: (id, { delta, reason }) =>
    api.patch(`/products/${id}/stock`, { delta, reason }).then((r) => r.data),
  seedProducts: (force = false) =>
    api.post(`/products/seed${force ? "?force=true" : ""}`).then((r) => r.data),

  // Alerts
  getAlerts: () => api.get("/alerts").then((r) => r.data),

  // Movements (Stock history)
  getMovements: (limit = 50, type) =>
    api
      .get("/movements", {
        params: { limit, ...(type ? { type } : {}) },
      })
      .then((r) => r.data),

  // Stats
  getStats: () => api.get("/stats").then((r) => r.data),

  // Health
  getHealth: () => api.get("/health").then((r) => r.data),

  // Suppliers
  getSuppliers: () => api.get("/suppliers").then((r) => r.data),
  createSupplier: (data) => api.post("/suppliers", data).then((r) => r.data),
  deleteSupplier: (id) => api.delete(`/suppliers/${id}`).then((r) => r.data),
  seedSuppliers: (force = false) =>
    api.post(`/suppliers/seed${force ? "?force=true" : ""}`).then((r) => r.data),

  // Orders (Purchase & Sales)
  getOrders: (params = {}) => api.get("/orders", { params }).then((r) => r.data),
  createOrder: (data) => api.post("/orders", data).then((r) => r.data),
};

export default inventoryApi;
