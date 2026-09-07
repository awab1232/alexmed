"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Eye, Loader2, Send, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  processing: "قيد المعالجة",
  ready_for_review: "تحتاج مراجعة",
  published: "منشورة",
  archived: "مؤرشفة",
  failed: "فاشلة",
};

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ar", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminMaterialsListPage() {
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();
  const listQuery = trpc.adminMaterials.list.useQuery({
    search: search || undefined,
  });

  const invalidate = () => utils.adminMaterials.list.invalidate();
  const publishMutation = trpc.adminMaterials.publish.useMutation({
    onSuccess: invalidate,
  });
  const archiveMutation = trpc.adminMaterials.archive.useMutation({
    onSuccess: invalidate,
  });
  const deleteMutation = trpc.adminMaterials.delete.useMutation({
    onSuccess: invalidate,
  });

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> لوحة تحكم الأدمن
          </div>
          <h1>كل الملفات</h1>
        </div>
      </div>

      <div className="cards-toolbar">
        <div className="search-box">
          <span>⌕</span>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="ابحث بالاسم أو العنوان..."
          />
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري التحميل...</h3>
        </div>
      ) : !listQuery.data?.length ? (
        <div className="empty-state">
          <h3>لا توجد ملفات</h3>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>اسم الملف</th>
                <th>التصنيف</th>
                <th>الصفحات</th>
                <th>البطاقات</th>
                <th>الحالة</th>
                <th>تاريخ الرفع</th>
                <th>تاريخ النشر</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.data.map(material => (
                <tr key={material.id}>
                  <td>{material.title}</td>
                  <td>{material.category || "—"}</td>
                  <td>{material.pageCount}</td>
                  <td>{material.cardCount}</td>
                  <td>{STATUS_LABELS[material.status] ?? material.status}</td>
                  <td>{formatDate(material.createdAt)}</td>
                  <td>{formatDate(material.publishedAt)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Link
                        href={`/admin/materials/${material.id}/review`}
                        className="secondary-button"
                        title="مراجعة"
                      >
                        <Eye size={14} />
                      </Link>
                      {material.status === "ready_for_review" && (
                        <button
                          type="button"
                          className="secondary-button"
                          title="نشر"
                          disabled={publishMutation.isPending}
                          onClick={() =>
                            publishMutation.mutate({ materialId: material.id })
                          }
                        >
                          <Send size={14} />
                        </button>
                      )}
                      {(material.status === "published" ||
                        material.status === "ready_for_review" ||
                        material.status === "failed") && (
                        <button
                          type="button"
                          className="secondary-button"
                          title="إخفاء/أرشفة"
                          disabled={archiveMutation.isPending}
                          onClick={() =>
                            archiveMutation.mutate({ materialId: material.id })
                          }
                        >
                          <Archive size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary-button"
                        title="حذف"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`حذف "${material.title}" نهائيًا؟`)) {
                            deleteMutation.mutate({ materialId: material.id });
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
