import { supabase } from "./supabase.js";

let isConnected = false;
let lastCheckTime = 0;

export async function connectDB() {
  const now = Date.now();
  // Cache health check for 15 seconds to avoid spamming the network
  if (isConnected && now - lastCheckTime < 15000) {
    return true;
  }

  try {
    // Quick probe to Supabase REST endpoint
    const { error, status } = await supabase.from("todos").select("id").limit(1);

    // Any HTTP status between 200 and 499 indicates the Supabase API Gateway is responsive!
    // (e.g. 404/PGRST205 just means table hasn't been created yet, but Supabase is fully online)
    if (status && status >= 200 && status < 500) {
      isConnected = true;
      lastCheckTime = now;
      return true;
    }

    if (error && error.code) {
      isConnected = true;
      lastCheckTime = now;
      return true;
    }

    isConnected = false;
    return false;
  } catch (err) {
    console.warn("Supabase ping failed:", err.message);
    isConnected = false;
    return false;
  }
}

export function getDbStatus() {
  return isConnected ? "connected" : "connecting";
}

export async function disconnectFromMongoDB() {
  // Legacy cleanup function - no-op for Supabase HTTP client
  isConnected = false;
}

export const connectToMongoDB = connectDB;

export { supabase };
export default supabase;
