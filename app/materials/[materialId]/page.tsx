"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CircleAlert, Loader2, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// تفاصيل مادة أدمن للطالب — استخدام studentMaterialsRouter.get، الذي يرمي
// NOT_FOUND لأي حالة غير "published" (يبدو تمامًا كملف غير موجود للطالب).
export default function StudentMaterialDetailPage() {
  const params = useParams<{ materialId: string }>();
  const materialId = params.materialId;
  const router = useRouter();

  const query = trpc.materials.get.useQuery({ materialId });

  if (query.isLoading) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري التحميل...</h3>
        </div>
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>تعذر العثور على هذه المادة</h3>
          <Link href="/materials" className="secondary-button" style={{ marginTop: 12 }}>
            العودة للمكتبة
          </Link>
        </div>
      </section>
    );
  }

  const { material, progress } = query.data;
  const progressPercent = progress.total
    ? Math.round((progress.reviewed / progress.total) * 100)
    : 0;

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <Link href="/materials" className="eyebrow" style={{ marginBottom: 8 }}>
            <span className="eyebrow-dot" /> ‹ رجوع للمكتبة
          </Link>
          <h1>{material.title}</h1>
          <p>{material.description}</p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span>البطاقات</span>
          <strong>{progress.total}</strong>
        </div>
        <div className="stat-card">
          <span>الصفحات</span>
          <strong>{material.pageCount}</strong>
        </div>
        <div className="stat-card accent">
          <span>نسبة التقدم</span>
          <strong>{progressPercent}%</strong>
        </div>
        <div className="stat-card">
          <span>مستحقة اليوم</span>
          <strong>{progress.dueToday}</strong>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
        <button
          type="button"
          className="primary-button"
          onClick={() => router.push(`/materials/${materialId}/review`)}
        >
          بدء المراجعة
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => router.push(`/materials/${materialId}/review?filter=due`)}
        >
          <RotateCcw size={16} /> البطاقات المستحقة اليوم
        </button>
      </div>
    </section>
  );
}
