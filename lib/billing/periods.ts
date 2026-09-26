// Usage periods. A "day" is the calendar day in the app's timezone
// (BILLING_TIMEZONE, default Asia/Amman — the students' region, no DST), a
// "month" the calendar month. Usage rows are keyed by these strings, so a
// new period is simply a new row: nothing has to run at midnight.

export function billingTimeZone(): string {
  return process.env.BILLING_TIMEZONE || "Asia/Amman";
}

function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find(part => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function periodKeys(now = new Date(), timeZone = billingTimeZone()) {
  const p = localParts(now, timeZone);
  const day = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const month = `${p.year}-${pad(p.month)}`;
  // Offset of the timezone from UTC right now (ms), to find local midnight.
  const wallAsUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second
  );
  const offset = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  const dayResetsAt = new Date(
    Date.UTC(p.year, p.month - 1, p.day + 1) - offset
  );
  const monthResetsAt = new Date(Date.UTC(p.year, p.month, 1) - offset);
  return { day, month, dayResetsAt, monthResetsAt };
}
