import path from "node:path";
import { defineConfig } from "vitest/config";

// Force non-production React builds so @testing-library/react can use React.act.
process.env.NODE_ENV = "test";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    clearMocks: true,
    env: { NODE_ENV: "test" },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
