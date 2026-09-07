"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, GraduationCap, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// مكتبة الأدمن — الطالب: شبكة المواد المنشورة فقط (كل التصفية/البحث يمر عبر
// studentMaterialsRouter.list، الذي يفرض status="published" من الخادم دومًا).
export default function StudentMaterialsPage() {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<"" | "easy" | "medium" | "hard">(
    ""
  );

  const materialsQuery = trpc.materials.list.useQuery({
    search: search || undefined,
    difficulty: difficulty || undefined,
  });

  return (
    <section className="upload-view">
      <div className="cards-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> مكتبة الأدمن
          </div>
          <h1>
            مواد <em>جاهزة للمراجعة.</em>
          </h1>
          <p>محتوى راجعه ونشره فريق الأدمن.</p>
        </div>
      </div>

      <div className="cards-toolbar">
        <div className="search-box">
          <span>⌕</span>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="ابحث في المواد..."
          />
        </div>
        <select
          className="text-input"
          style={{ width: "auto" }}
          value={difficulty}
          onChange={event =>
            setDifficulty(event.target.value as "" | "easy" | "medium" | "hard")
          }
        >
          <option value="">كل المستويات</option>
          <option value="easy">سهل</option>
          <option value="medium">متوسط</option>
          <option value="hard">صعب</option>
        </select>
      </div>

      {materialsQuery.isError ? (
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>تعذر تحميل المكتبة</h3>
        </div>
      ) : materialsQuery.isLoading ? (
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري التحميل...</h3>
        </div>
      ) : !materialsQuery.data?.length ? (
        <div className="empty-state">
          <GraduationCap size={28} />
          <h3>لا توجد مواد منشورة بعد</h3>
        </div>
      ) : (
        <div className="library-grid">
          {materialsQuery.data.map(material => (
            <Link
              href={`/materials/${material.id}`}
              className="library-item"
              key={material.id}
            >
              <div className="library-item-icon">
                <GraduationCap size={18} />
              </div>
              <div className="library-item-meta">
                <strong>{material.title}</strong>
                <span>
                  {material.category ? `${material.category} · ` : ""}
                  {material.pageCount} صفحة · {material.cardCount} بطاقة
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
