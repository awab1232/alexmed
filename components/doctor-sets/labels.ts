// Display helpers shared by the doctor dashboard, the admin pages and the
// student's question-set screens.

type SetForStatus = {
  status: "draft" | "published" | "disabled" | "archived";
  bookStatus?: string | null;
  processingDone?: boolean | null;
  windowOpen?: boolean | null;
  endsAt?: Date | string | null;
  startsAt?: Date | string | null;
};

export type SetStatusLabel = {
  label: string;
  tone: "live" | "warn" | "stop" | "muted";
};

// One label per set, in the order a doctor cares about: is it broken, is
// it still processing, is it live for students right now.
export function setStatusLabel(set: SetForStatus): SetStatusLabel {
  if (set.status === "archived") return { label: "مؤرشفة", tone: "muted" };
  if (set.status === "disabled") return { label: "معطّلة", tone: "stop" };
  if (set.status === "draft") {
    if (set.bookStatus === "failed")
      return { label: "فشلت المعالجة", tone: "stop" };
    if (!set.processingDone) return { label: "جاري المعالجة", tone: "warn" };
    return { label: "جاهزة للنشر", tone: "warn" };
  }
  if (set.windowOpen === false) {
    const ended = set.endsAt && new Date(set.endsAt).getTime() <= Date.now();
    return ended
      ? { label: "منتهية", tone: "muted" }
      : { label: "لم تبدأ بعد", tone: "warn" };
  }
  return { label: "منشورة", tone: "live" };
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ar-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// <input type="datetime-local"> works in the viewer's local time without a
// zone; these convert to/from a real Date (the server compares with its
// own clock).
export function toLocalInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  created: "إنشاء المجموعة",
  settings_updated: "تعديل الإعدادات",
  published: "نشر",
  disabled: "تعطيل",
  enabled: "إعادة تفعيل",
  archived: "أرشفة",
  codes_generated: "توليد أكواد",
  code_revoked: "إلغاء كود",
  code_claimed: "تفعيل كود من طالب",
  student_revoked: "سحب وصول طالب",
  admin_disabled: "تعطيل من الإدارة",
  admin_enabled: "تفعيل من الإدارة",
  admin_archived: "أرشفة من الإدارة",
  admin_viewed: "اطلاع الإدارة",
  access_denied_rate_limit: "حظر مؤقت بسبب محاولات كثيرة",
};
