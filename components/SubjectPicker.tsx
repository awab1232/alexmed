"use client";

import { useState } from "react";
import { FolderPlus, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// Shared "where does this file go?" control for every upload flow (مِرآة PDF,
// مِرآة pasted text, كتبي study-book/question-file upload) — folder
// assignment is now mandatory at upload time everywhere, so there is
// deliberately no "بدون مجلد" option here. Lets the student either pick one
// of their existing subjects/folders or create a new one inline without
// leaving the upload screen.
export default function SubjectPicker({
  value,
  onChange,
  label = "احفظ الملف في",
}: {
  value: string;
  onChange: (subjectId: string) => void;
  label?: string;
}) {
  const utils = trpc.useUtils();
  const subjectsQuery = trpc.subjects.list.useQuery();
  const createMutation = trpc.subjects.create.useMutation({
    onSuccess: subject => {
      utils.subjects.list.invalidate();
      onChange(subject.id);
      setCreating(false);
      setNewName("");
    },
  });

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const subjects = subjectsQuery.data ?? [];

  function submitNewFolder() {
    const name = newName.trim();
    if (!name || createMutation.isPending) return;
    createMutation.mutate({ name });
  }

  return (
    <div className="subject-picker">
      <span className="subject-picker-label">{label}</span>
      {creating ? (
        <div className="subject-picker-create-row">
          <input
            autoFocus
            value={newName}
            placeholder="اسم المجلد (مثال: تشريح، رياضيات ١)"
            onChange={event => setNewName(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitNewFolder();
              }
              if (event.key === "Escape") setCreating(false);
            }}
          />
          <button
            type="button"
            className="primary-button"
            disabled={!newName.trim() || createMutation.isPending}
            onClick={submitNewFolder}
          >
            {createMutation.isPending ? (
              <Loader2 size={15} className="spin" />
            ) : (
              "إنشاء"
            )}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setCreating(false)}
          >
            إلغاء
          </button>
        </div>
      ) : (
        <div className="subject-picker-row">
          <select
            value={value}
            onChange={event => onChange(event.target.value)}
            disabled={subjectsQuery.isLoading}
          >
            <option value="" disabled>
              {subjectsQuery.isLoading ? "جاري التحميل..." : "اختر مجلدًا..."}
            </option>
            {subjects.map(subject => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setCreating(true)}
          >
            <FolderPlus size={15} /> مجلد جديد
          </button>
        </div>
      )}
      {createMutation.error && (
        <p className="subject-picker-error">
          تعذّر إنشاء المجلد. حاول مرة أخرى.
        </p>
      )}
      {!value && !creating && (
        <small className="subject-picker-hint">
          اختيار مجلد إجباري قبل المتابعة.
        </small>
      )}
    </div>
  );
}
