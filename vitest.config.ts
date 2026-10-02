import { defineConfig } from "vitest/config";
import path from "node:path";

// Standalone test config (the app's vite config targets the Worker runtime).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
