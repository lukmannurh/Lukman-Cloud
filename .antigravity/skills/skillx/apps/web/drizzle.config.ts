import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./app/lib/db/schema.ts",
  dialect: "sqlite",
});
