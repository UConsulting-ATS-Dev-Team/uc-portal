import { defineConfig } from "vitest/config";

// Separate config from the frontend so `npm run test:server` runs only the
// job-engine pipeline tests, decoupled from the Vite React app entirely --
// per Stage 1, this code has no database or frontend dependency at all.
export default defineConfig({
  test: {
    include: ["server/tests/**/*.test.ts"],
    environment: "node",
  },
});
