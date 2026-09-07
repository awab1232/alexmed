"use client";

import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  FileText,
  Layers3,
  Loader2,
  Plus,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// لوحة تحكم الأدمن — الصفحة الرئيسية: إحصائيات عامة + آخر المواد المضافة.
// جدول الملفات الكامل بأزراره منفصل بـ /admin/materials/list.
export default function AdminMaterialsDashboardPage() {
  const statsQuery = trpc.adminMaterials.stats.useQuery();
  const listQuery = trpc.adminMaterials.list.useQuery(undefined);
  const recent = listQuery.data?.slice(0, 5) ?? [];

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> لوحة تحكم الأدمن
          </div>
          <h1>
            مكتبة <em>الأدمن.</em>
          </h1>
          <p>إدارة المواد المنشورة للطلاب.</p>
        </div>
        <div className="header-actions">
          <Link href="/admin/materials/upload" className="secondary-button">
            <Plus size={16} /> رفع مادة جديدة
          </Link>
          <Link href="/admin/materials/list" className="ghost-button">
            <FileText size={16} /> كل الملفات
          </Link>
        </div>
      </div>

      {statsQuery.isLoading ? (
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري تحميل الإحصائيات...</h3>
        </div>
      ) : (
        <div className="stats-row">
          <div className="stat-card">
            <span>إجمالي الملفات</span>
            <strong>{statsQuery.data?.total ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>منشورة</span>
            <strong>{statsQuery.data?.published ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>قيد المعالجة</span>
            <strong>{statsQuery.data?.processing ?? 0}</strong>
          </div>
          <div className="stat-card accent">
            <span>تحتاج مراجعة</span>
            <strong>{statsQuery.data?.readyForReview ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>فاشلة</span>
            <strong>{statsQuery.data?.failed ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>بطاقات منشورة</span>
            <strong>{statsQuery.data?.publishedCardCount ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>مرات مراجعة الطلاب</span>
            <strong>{statsQuery.data?.reviewEventCount ?? 0}</strong>
          </div>
        </div>
      )}

      <div className="cards-header" style={{ marginTop: 24 }}>
        <div>
          <h2 style={{ fontSize: 18 }}>آخر الملفات المضافة</h2>
        </div>
      </div>

      {!recent.length ? (
        <div className="empty-state">
          <Layers3 size={28} />
          <h3>لا توجد ملفات بعد</h3>
        </div>
      ) : (
        <div className="library-grid">
          {recent.map(material => (
            <Link
              href={`/admin/materials/${material.id}/review`}
              className="library-item"
              key={material.id}
            >
              <div className="library-item-icon">
                {material.status === "published" ? (
                  <CheckCircle2 size={18} />
                ) : material.status === "failed" ? (
                  <CircleAlert size={18} />
                ) : (
                  <Loader2
                    size={18}
                    className={material.status === "processing" ? "spin" : ""}
                  />
                )}
              </div>
              <div className="library-item-meta">
                <strong>{material.title}</strong>
                <span>
                  {material.pageCount} صفحة · {material.cardCount} بطاقة ·{" "}
                  {material.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
