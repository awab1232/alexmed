"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import s from "@/components/doctor-sets/doctorSets.module.css";
import StatusChip from "@/components/doctor-sets/StatusChip";

// "انضم كدكتور" — a normal NiroLearn account asks for the doctor
// capability; an admin reviews it (app/admin/doctors). Same account, same
// login: nothing about signing in changes.
export default function DoctorApplicationPage() {
  const router = useRouter();
  const enabled = trpc.questionSets.enabled.useQuery();
  const status = trpc.doctor.status.useQuery(undefined, {
    enabled: enabled.data === true,
  });
  const utils = trpc.useUtils();
  const apply = trpc.doctor.submitApplication.useMutation({
    onSuccess: () => utils.doctor.status.invalidate(),
  });

  const [form, setForm] = useState({
    fullName: "",
    university: "",
    faculty: "",
    department: "",
    universityEmail: "",
    note: "",
  });
  const set = (key: keyof typeof form) => (value: string) =>
    setForm(current => ({ ...current, [key]: value }));

  if (enabled.data === false) {
    return (
      <section className="upload-view">
        <div className={s.page}>
          <div className={s.empty}>
            <strong>هذه الميزة غير متاحة حاليًا.</strong>
            <Link href="/account" className="secondary-button">
              العودة لحسابي
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const profile = status.data?.profile;
  const showForm = !profile || profile.status === "rejected";

  return (
    <section className="upload-view">
      <div className={s.page}>
        <header className={s.header}>
          <Link href="/account" className={s.back}>
            ‹ حسابي
          </Link>
          <h1>حساب دكتور</h1>
          <p>
            ارفع ملفات أسئلتك، وأعطِ طلابك أكواد دخول. يبقى حسابك كما هو، ونفس
            تسجيل الدخول.
          </p>
        </header>

        {status.isLoading || enabled.isLoading ? (
          <p className={s.note}>جاري التحميل...</p>
        ) : null}

        {profile?.status === "pending" && (
          <div className={s.empty}>
            <StatusChip label="قيد المراجعة" tone="warn" />
            <strong>طلبك وصل وسيراجعه فريق NiroLearn.</strong>
            <span>
              {profile.fullName} · {profile.university} · {profile.faculty}
            </span>
          </div>
        )}

        {profile?.status === "approved" && status.data?.approved && (
          <div className={s.empty}>
            <StatusChip label="دكتور معتمد" tone="live" />
            <strong>حسابك معتمد كدكتور.</strong>
            <button
              type="button"
              className="nl-marker-button"
              onClick={() => router.push("/doctor")}
            >
              افتح لوحة الدكتور
            </button>
          </div>
        )}

        {profile?.status === "suspended" && (
          <div className={s.empty}>
            <StatusChip label="موقوف" tone="stop" />
            <strong>صلاحيات الدكتور موقوفة حاليًا.</strong>
            <span>
              مجموعاتك غير متاحة لطلابك أثناء الإيقاف. تواصل معنا لمعرفة السبب.
            </span>
            <Link href="/contact" className="secondary-button">
              تواصل معنا
            </Link>
          </div>
        )}

        {profile?.status === "rejected" && (
          <div className={s.empty}>
            <StatusChip label="لم يُقبل الطلب" tone="stop" />
            <strong>لم نتمكن من اعتماد طلبك السابق.</strong>
            {profile.rejectionReason ? (
              <span>السبب: {profile.rejectionReason}</span>
            ) : null}
            <span>يمكنك تعديل البيانات وإرسال طلب جديد.</span>
          </div>
        )}

        {showForm && !status.isLoading && (
          <form
            className={s.form}
            onSubmit={event => {
              event.preventDefault();
              apply.mutate({
                fullName: form.fullName,
                university: form.university,
                faculty: form.faculty,
                department: form.department,
                universityEmail: form.universityEmail.trim() || null,
                note: form.note.trim() || null,
              });
            }}
          >
            <label className={s.field} htmlFor="doctor-full-name">
              الاسم الكامل
              <input
                id="doctor-full-name"
                required
                minLength={2}
                maxLength={120}
                value={form.fullName}
                onChange={event => set("fullName")(event.target.value)}
              />
            </label>
            <div className={s.fieldRow}>
              <label className={s.field} htmlFor="doctor-university">
                الجامعة
                <input
                  id="doctor-university"
                  required
                  minLength={2}
                  maxLength={160}
                  value={form.university}
                  onChange={event => set("university")(event.target.value)}
                />
              </label>
              <label className={s.field} htmlFor="doctor-faculty">
                الكلية
                <input
                  id="doctor-faculty"
                  required
                  minLength={2}
                  maxLength={160}
                  value={form.faculty}
                  onChange={event => set("faculty")(event.target.value)}
                />
              </label>
            </div>
            <label className={s.field} htmlFor="doctor-department">
              القسم
              <input
                id="doctor-department"
                required
                minLength={2}
                maxLength={160}
                value={form.department}
                onChange={event => set("department")(event.target.value)}
              />
            </label>
            <label className={s.field} htmlFor="doctor-email">
              البريد الجامعي <small>(اختياري، يساعد في التحقق)</small>
              <input
                id="doctor-email"
                type="email"
                dir="ltr"
                maxLength={320}
                value={form.universityEmail}
                onChange={event => set("universityEmail")(event.target.value)}
              />
            </label>
            <label className={s.field} htmlFor="doctor-note">
              ملاحظة للمراجعة <small>(اختياري)</small>
              <textarea
                id="doctor-note"
                maxLength={1000}
                value={form.note}
                onChange={event => set("note")(event.target.value)}
              />
            </label>
            {apply.error ? (
              <p className={s.error} role="alert">
                {apply.error.message}
              </p>
            ) : null}
            <div className={s.actions}>
              <button
                type="submit"
                className="nl-marker-button"
                disabled={apply.isPending}
              >
                {apply.isPending ? "جاري الإرسال..." : "أرسل الطلب"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
