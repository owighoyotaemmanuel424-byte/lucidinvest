/**
 * Next.js calls this once per server instance before requests are handled.
 * Keeping the schema check here means a deployment that ships new columns
 * upgrades its database before the first sign-in reaches the new code.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { ensureDatabaseSchema } = await import("./lib/schema");
    await ensureDatabaseSchema();
  } catch (error) {
    console.error(
      "Database schema upgrade failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}
