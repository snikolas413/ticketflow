import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

const connectionUrl = new URL(connectionString);
const sslMode = connectionUrl.searchParams.get("sslmode");
connectionUrl.searchParams.delete("sslmode");
const sslCa = process.env.DATABASE_SSL_CA;
const ssl = sslCa ? { ca: sslCa } : sslMode === "require" ? { rejectUnauthorized: false } : undefined;

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle-supabase",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionUrl.toString(),
    ssl,
  },
});
