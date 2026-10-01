import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite builds the React app; the Cloudflare plugin runs the Worker
// (src/worker/) alongside it in development and builds both for deploy.
export default defineConfig({
  plugins: [react(), cloudflare()],
});
