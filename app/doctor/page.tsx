"use client";

import Link from "next/link";
import { Lock, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import s from "@/components/doctor-sets/doctorSets.module.css";
import StatusChip from "@/components/doctor-sets/StatusChip";
import {
  AUDIT_EVENT_LABELS,
  formatDateTime,
  setStatusLabel,
} from "@/components/doctor-sets/labels";

// لوحة الدكتور — the doctor's question sets and the numbers that matter:
// how many are live, how many codes went out, how many students are in.
export default function DoctorDashboardPage() {
  const stats = trpc.doctor.stats.useQuery();
  const sets = trpc.doctor.sets.list.useQuery(undefined, {
    // Keep the "جاري المعالجة" rows moving until the pipeline finishes.
    refetchInterval: query =>
      (query.state.data ?? []).some(
        set => set.status === "draft" && !set.processingDone
      )
        ? 4000
        : false,
  });
  const numbers = stats.data;

  return (
    <section className="upload-view">
      <div className={s.page}>
        <header className={s.header}>
          <Link href="/account" className={s.back}>
            ‹ حسابي
          </Link>
          <h1>لوحة الدكتور</h1>
          <p>مجموعات أسئلة محمية: ترفع الملف مرة واحدة، وطلابك يدخلون بكود.</p>
        </header>

        <dl className={s.stats} aria-label="أرقام المجموعات">
          <div className={s.stat}>
            <dt>المجموعات</dt>
            <dd>{numbers?.totalSets ?? "—"}</dd>
          </div>
          <div className={s.stat}>
            <dt>منشورة</dt>
            <dd>{numbers?.published ?? "—"}</dd>
          </div>
          <div className={s.stat}>
            <dt>معطّلة</dt>
            <dd>{numbers?.disabled ?? "—"}</dd>
          </div>
          <div className={s.stat}>
            <dt>أكواد مولّدة</dt>
            <dd>{numbers?.codesTotal ?? "—"}</dd>
          </div>
          <div className={s.stat}>
            <dt>طلاب مفعّلون</dt>
            <dd>{numbers?.activeStudents ?? "—"}</dd>
          </div>
        </dl>

        <div className={s.section}>
          <div className={s.sectionHead}>
            <h2>مجموعاتي</h2>
            <Link href="/doctor/sets/new" className="nl-marker-button">
              <Plus size={16} aria-hidden="true" /> مجموعة جديدة
            </Link>
          </div>

          {sets.isLoading ? <p className={s.note}>جاري التحميل...</p> : null}

          {sets.data && !sets.data.length ? (
            <div className={s.empty}>
              <strong>لا توجد مجموعات بعد.</strong>
              <span>
                ارفع ملف أسئلة PDF، راجع الأسئلة المستخرجة، ثم انشرها وولّد
                أكوادًا لطلابك.
              </span>
            </div>
          ) : null}

          {!!sets.data?.length && (
            <ul className={s.list}>
              {sets.data.map(set => (
                <li key={set.id}>
                  <Link href={`/doctor/sets/${set.id}`} className={s.row}>
                    <Lock size={16} aria-hidden="true" />
                    <span className={s.rowMain}>
                      <span className={s.rowTitle}>{set.title}</span>
                      <span className={s.rowMeta}>
                        {set.status === "draft"
                          ? `${set.extractedQuestions} سؤال مستخرج`
                          : `${set.questionCount} سؤال`}{" "}
                        · {set.activeStudents} طالب · {set.codesClaimed}/
                        {set.codesTotal} كود مستخدم
                      </span>
                    </span>
                    <StatusChip {...setStatusLabel(set)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!!numbers?.recent.length && (
          <div className={s.section}>
            <h2 style={{ margin: 0, fontSize: 16 }}>آخر النشاط</h2>
            <ul className={s.list}>
              {numbers.recent.map(event => (
                <li key={event.id} className={s.row}>
                  <span className={s.rowMain}>
                    <span className={s.rowTitle}>
                      {AUDIT_EVENT_LABELS[event.event] ?? event.event}
                      {typeof event.meta?.count === "number"
                        ? ` (${event.meta.count})`
                        : ""}
                    </span>
                    <span className={s.rowMeta}>
                      {event.setTitle} · {formatDateTime(event.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
