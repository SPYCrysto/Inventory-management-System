import app from "../server/app.js";
import { connectDB } from "../server/db.js";

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    console.error("Vercel Function DB Connection Error:", err);
  }
  return app(req, res);
}
