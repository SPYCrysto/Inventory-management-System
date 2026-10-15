import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
    env: {
      NODE_ENV: "test",
    },
    testTimeout: 10000,
  },
});
