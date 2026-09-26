// Drizzle wraps driver errors ("Failed query: …") and keeps the Postgres
// error as `cause`, so checks on error.message miss it. This walks the
// cause chain for the real SQLSTATE / constraint name.
type PgLikeError = {
  code?: string;
  constraint_name?: string;
  constraint?: string;
  message?: string;
  cause?: unknown;
};

// True for a unique-constraint violation (SQLSTATE 23505), optionally only
// for the named constraint / unique index.
export function isUniqueViolation(
  error: unknown,
  constraint?: string
): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const e = current as PgLikeError;
    if (e.code === "23505") {
      if (!constraint) return true;
      const name = e.constraint_name ?? e.constraint ?? "";
      return name === constraint || (e.message ?? "").includes(constraint);
    }
    current = e.cause;
  }
  return false;
}
