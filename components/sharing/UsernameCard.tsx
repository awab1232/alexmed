"use client";

import { useEffect, useState } from "react";
import { AtSign, Check, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// 📤 The student's public handle for Study Pack sharing. Opt-in: until a
// student picks one, nobody can find them in sharing search. Email is never
// searchable or shown to other students.
export function UsernameCard({ compact = false }: { compact?: boolean }) {
  const utils = trpc.useUtils();
  const profile = trpc.sharing.profile.useQuery();
  const [value, setValue] = useState("");
  useEffect(() => {
    if (profile.data?.username) setValue(profile.data.username);
  }, [profile.data?.username]);
  const save = trpc.sharing.setUsername.useMutation({
    onSuccess: result => {
      setValue(result.username);
      utils.sharing.profile.invalidate();
    },
  });

  if (profile.isLoading) return null;
  const current = profile.data?.username ?? null;
  const dirty = value.trim().replace(/^@+/, "").toLowerCase() !== current;

  return (
    <form
      className={compact ? "sh-username is-compact" : "sh-username"}
      onSubmit={event => {
        event.preventDefault();
        if (dirty) save.mutate({ username: value });
      }}
    >
      <div className="sh-username-head">
        <strong>
          <AtSign size={16} aria-hidden="true" /> اسم المستخدم للمشاركة
        </strong>
        <span>
          {current
            ? "يجدك زملاؤك بهذا الاسم ليشاركوا معك ملفاتهم. بريدك الإلكتروني لا يظهر لأحد."
            : "اختر اسم مستخدم ليتمكن زملاؤك من إيجادك ومشاركة ملفاتهم معك. بريدك الإلكتروني لا يظهر لأحد."}
        </span>
      </div>
      <div className="sh-username-row">
        <label className="sh-username-input" dir="ltr">
          <span aria-hidden="true">@</span>
          <input
            value={value}
            onChange={event => {
              setValue(event.target.value);
              save.reset();
            }}
            placeholder="your.name"
            aria-label="اسم المستخدم"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={40}
          />
        </label>
        <button
          type="submit"
          className="primary-button"
          disabled={!dirty || !value.trim() || save.isPending}
        >
          {save.isPending ? (
            <Loader2 size={15} className="spin" />
          ) : save.isSuccess && !dirty ? (
            <Check size={15} />
          ) : null}
          {current ? "حفظ" : "اختيار"}
        </button>
      </div>
      {save.error ? (
        <p className="sh-error" role="alert">
          {save.error.message}
        </p>
      ) : (
        <p className="sh-hint">
          من <bdi dir="ltr">3</bdi> إلى <bdi dir="ltr">24</bdi> حرفًا:
          أحرف إنجليزية صغيرة وأرقام و <bdi dir="ltr">.</bdi> و{" "}
          <bdi dir="ltr">_</bdi>
        </p>
      )}
    </form>
  );
}
