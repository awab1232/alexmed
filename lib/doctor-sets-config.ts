// Feature flag for Protected Doctor Question Sets. Off unless the server
// sets DOCTOR_SETS_ENABLED=true: every doctor / redeem / admin procedure
// and page for the feature refuses while it's off, and nothing else in the
// app reads these tables, so existing behavior is untouched.
export function doctorSetsEnabled(): boolean {
  return process.env.DOCTOR_SETS_ENABLED === "true";
}
