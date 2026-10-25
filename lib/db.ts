import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | undefined;

/** Server-side Neon SQL client; never import this module into browser components. */
export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  if (!client) client = neon(connectionString);
  return client;
}
