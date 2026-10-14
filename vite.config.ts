import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // File-change events don't always cross a Docker bind mount; poll there.
    watch: process.env.DOCKER === "1" ? { usePolling: true, interval: 300 } : undefined,
  },
});
