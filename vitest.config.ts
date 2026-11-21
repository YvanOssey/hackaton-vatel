import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://cantine:cantine@localhost:5432/cantine_test?schema=public",
      DIRECT_URL: process.env.TEST_DATABASE_URL ?? "postgresql://cantine:cantine@localhost:5432/cantine_test?schema=public",
      APP_TIMEZONE: "Africa/Abidjan",
      AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
    },
  },
});
