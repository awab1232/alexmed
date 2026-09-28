"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import s from "@/components/doctor-sets/doctorSets.module.css";
import StatusChip from "@/components/doctor-sets/StatusChip";
import { formatDateTime } from "@/components/doctor-sets/labels";

// مجموعات الدكاترة — add an access code from your doctor, then open the set
// in the same question cards as any question file.
export default function QuestionSetsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const mine = trpc.questionSets.mine.useQuery();
  const catalog = trpc.questionSets.catalog.useQuery();
  const redeem = trpc.questionSets.redeem.useMutation({
    onSuccess: result => {
      void utils.questionSets.mine.invalidate();
      if (result.outcome === "already") {
        setNotice("هذه المجموعة مضافة لحسابك بالفعل.");
      }
      router.push(`/question-sets/${result.setId}`);
    },
  });

  const listed = (catalog.data ?? []).filter(set => !set.inMyAccount);

  return (
    <section className="upload-view">
      <div className={s.page}>
        <header className={s.header}>
          <Link href="/books/question-files" className={s.back}>
            ‹ ملفات الأسئلة
          </Link>
          <h1>مجموعات الدكاترة</h1>
          <p>أسئلة يشاركها دكتورك مع طلابه. الدخول بكود يعطيك إياه الدكتور.</p>
        </header>

        <form
          className={s.form}
          onSubmit={event => {
            event.preventDefault();
            setNotice("");
            redeem.mutate({ code });
          }}
        >
          <label className={s.field} htmlFor="access-code">
            كود الوصول
            <input
              id="access-code"
              className={s.codeInput}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              maxLength={40}
              placeholder="NL-XXXX-XXXX-XXXX"
              value={code}
              onChange={event => setCode(event.target.value)}
            />
          </label>
          {redeem.error ? (
            <p className={s.error} role="alert">
              {redeem.error.message}
            </p>
          ) : null}
          {notice ? (
            <p className={s.note} role="status">
              {notice}
            </p>
          ) : null}
          <div className={s.actions}>
            <button
              type="submit"
              className="nl-marker-button"
              disabled={redeem.isPending || code.trim().length < 12}
            >
              <KeyRound size={16} aria-hidden="true" />
              {redeem.isPending ? "جاري التحقق..." : "أضف المجموعة"}
            </button>
          </div>
        </form>

        <div className={s.section}>
          <h2 style={{ margin: 0, fontSize: 16 }}>مجموعاتي</h2>
          {mine.isLoading ? <p className={s.note}>جاري التحميل...</p> : null}
          {mine.data && !mine.data.length ? (
            <div className={s.empty}>
              <strong>لا توجد مجموعات بعد.</strong>
              <span>عندك كود من دكتورك؟ أدخله في الأعلى.</span>
            </div>
          ) : null}
          {!!mine.data?.length && (
            <ul className={s.list}>
              {mine.data.map(set => {
                const body = (
                  <>
                    <Lock size={16} aria-hidden="true" />
                    <span className={s.rowMain}>
                      <span className={s.rowTitle}>{set.title}</span>
                      <span className={s.rowMeta}>
                        {[
                          set.doctorName,
                          set.subjectLabel,
                          `${set.questionCount} سؤال`,
                          set.endsAt
                            ? `حتى ${formatDateTime(set.endsAt)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {set.availability === "available" ? (
                      <StatusChip label="متاحة" tone="live" />
                    ) : set.availability === "not_started" ? (
                      <StatusChip
                        label={`تفتح ${formatDateTime(set.startsAt)}`}
                        tone="warn"
                      />
                    ) : (
                      <StatusChip label="غير متاحة حاليًا" tone="muted" />
                    )}
                  </>
                );
                return (
                  <li key={set.id}>
                    {set.availability === "available" ? (
                      <Link href={`/question-sets/${set.id}`} className={s.row}>
                        {body}
                      </Link>
                    ) : (
                      <div className={s.row}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!!listed.length && (
          <div className={s.section}>
            <h2 style={{ margin: 0, fontSize: 16 }}>مجموعات منشورة</h2>
            <p className={s.note}>
              تظهر هنا للاطلاع فقط. فتح أي مجموعة يحتاج كودًا من دكتورها.
            </p>
            <ul className={s.list}>
              {listed.map(set => (
                <li key={set.id} className={s.row}>
                  <Lock size={16} aria-hidden="true" />
                  <span className={s.rowMain}>
                    <span className={s.rowTitle}>{set.title}</span>
                    <span className={s.rowMeta}>
                      {[
                        set.doctorName,
                        set.subjectLabel,
                        set.academicYear,
                        `${set.questionCount} سؤال`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className={s.lockTag}>🔒 بكود</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
