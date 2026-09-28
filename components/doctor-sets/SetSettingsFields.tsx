"use client";

import s from "./doctorSets.module.css";
import { fromLocalInput, toLocalInput } from "./labels";

export type SetSettingsValue = {
  title: string;
  description: string;
  subjectLabel: string;
  academicYear: string;
  examType: string;
  visibility: "listed" | "unlisted";
  startsAt: string; // datetime-local
  endsAt: string;
};

export const EMPTY_SETTINGS: SetSettingsValue = {
  title: "",
  description: "",
  subjectLabel: "",
  academicYear: "",
  examType: "",
  visibility: "unlisted",
  startsAt: "",
  endsAt: "",
};

export function settingsFromSet(set: {
  title: string;
  description: string | null;
  subjectLabel: string | null;
  academicYear: string | null;
  examType: string | null;
  visibility: "listed" | "unlisted";
  startsAt: Date | string | null;
  endsAt: Date | string | null;
}): SetSettingsValue {
  return {
    title: set.title,
    description: set.description ?? "",
    subjectLabel: set.subjectLabel ?? "",
    academicYear: set.academicYear ?? "",
    examType: set.examType ?? "",
    visibility: set.visibility,
    startsAt: toLocalInput(set.startsAt),
    endsAt: toLocalInput(set.endsAt),
  };
}

// What the API takes: empty text → null, local date-times → Date.
export function settingsPayload(value: SetSettingsValue) {
  return {
    title: value.title.trim(),
    description: value.description.trim() || null,
    subjectLabel: value.subjectLabel.trim() || null,
    academicYear: value.academicYear.trim() || null,
    examType: value.examType.trim() || null,
    visibility: value.visibility,
    startsAt: fromLocalInput(value.startsAt),
    endsAt: fromLocalInput(value.endsAt),
  };
}

export default function SetSettingsFields({
  value,
  onChange,
  idPrefix,
}: {
  value: SetSettingsValue;
  onChange: (next: SetSettingsValue) => void;
  idPrefix: string;
}) {
  const field =
    (key: keyof SetSettingsValue) => (event: { target: { value: string } }) =>
      onChange({ ...value, [key]: event.target.value });
  return (
    <>
      <label className={s.field} htmlFor={`${idPrefix}-title`}>
        عنوان المجموعة
        <input
          id={`${idPrefix}-title`}
          required
          maxLength={200}
          placeholder="Anatomy Midterm 2026"
          value={value.title}
          onChange={field("title")}
        />
      </label>
      <label className={s.field} htmlFor={`${idPrefix}-description`}>
        الوصف <small>(اختياري)</small>
        <textarea
          id={`${idPrefix}-description`}
          maxLength={2000}
          value={value.description}
          onChange={field("description")}
        />
      </label>
      <div className={s.fieldRow}>
        <label className={s.field} htmlFor={`${idPrefix}-subject`}>
          المادة
          <input
            id={`${idPrefix}-subject`}
            maxLength={120}
            value={value.subjectLabel}
            onChange={field("subjectLabel")}
          />
        </label>
        <label className={s.field} htmlFor={`${idPrefix}-year`}>
          السنة الدراسية
          <input
            id={`${idPrefix}-year`}
            maxLength={120}
            value={value.academicYear}
            onChange={field("academicYear")}
          />
        </label>
        <label className={s.field} htmlFor={`${idPrefix}-exam`}>
          نوع الامتحان
          <input
            id={`${idPrefix}-exam`}
            maxLength={120}
            placeholder="Midterm / Final / Quiz"
            value={value.examType}
            onChange={field("examType")}
          />
        </label>
      </div>
      <fieldset
        className={s.field}
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <legend style={{ marginBottom: 6 }}>الظهور</legend>
        <div className={s.choice}>
          <label>
            <input
              type="radio"
              name={`${idPrefix}-visibility`}
              checked={value.visibility === "unlisted"}
              onChange={() => onChange({ ...value, visibility: "unlisted" })}
            />
            غير مدرجة — تعطي الأكواد لطلابك مباشرة
          </label>
          <label>
            <input
              type="radio"
              name={`${idPrefix}-visibility`}
              checked={value.visibility === "listed"}
              onChange={() => onChange({ ...value, visibility: "listed" })}
            />
            مدرجة — يظهر عنوانها للطلاب، والدخول بكود فقط
          </label>
        </div>
      </fieldset>
      <div className={s.fieldRow}>
        <label className={s.field} htmlFor={`${idPrefix}-starts`}>
          تبدأ <small>(اختياري)</small>
          <input
            id={`${idPrefix}-starts`}
            type="datetime-local"
            value={value.startsAt}
            onChange={field("startsAt")}
          />
        </label>
        <label className={s.field} htmlFor={`${idPrefix}-ends`}>
          تنتهي <small>(اختياري)</small>
          <input
            id={`${idPrefix}-ends`}
            type="datetime-local"
            value={value.endsAt}
            onChange={field("endsAt")}
          />
        </label>
      </div>
    </>
  );
}
