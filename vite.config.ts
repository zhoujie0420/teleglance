import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    port: 5174,
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
