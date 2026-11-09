import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" supaya hasil build bisa dibuka dari folder mana pun.
// /api diteruskan ke server chatbot (server/server.js, port 8787) saat pengembangan.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { proxy: { "/api": "http://localhost:8787" } },
});
