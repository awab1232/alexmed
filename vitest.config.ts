import path from "path";
import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: {
      "@": projectRoot,
      "@shared": path.resolve(projectRoot, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
