import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [react()],
  publicDir: resolve(import.meta.dirname, "../../assets"),
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    fs: { allow: [resolve(import.meta.dirname, "../..")] },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes("/three/") ? "three" : undefined),
      },
    },
  },
});
