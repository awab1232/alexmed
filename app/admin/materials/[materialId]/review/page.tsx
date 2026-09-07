"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, Send, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

type ReviewStatusFilter = "all" | "pending" | "approved" | "needs_review";
type ConfidenceFilter = "all" | "high" | "medium" | "low";

// مراجعة بطاقات مادة أدمن قبل النشر: تعديل مباشر لكل حقل، فلاتر ثقة/حالة
// مراجعة، بحث، تحديد متعدد + اعتماد/حذف جماعي، وزر نشر أعلى الصفحة.
export default function AdminMaterialReviewPage() {
  const params = useParams<{ materialId: string }>();
  const materialId = params.materialId;
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusFilter>("all");
  const [confidence, setConfidence] = useState<ConfidenceFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Record<string, Record<string, string>>>({});

  const materialQuery = trpc.adminMaterials.get.useQuery({ materialId });
  const cardsQuery = trpc.adminMaterials.cardsForReview.useQuery({
    materialId,
    search: search || undefined,
    reviewStatus: reviewStatus === "all" ? undefined : reviewStatus,
    confidence: confidence === "all" ? undefined : confidence,
  });

  const invalidateCards = () => {
    utils.adminMaterials.cardsForReview.invalidate({ materialId });
    utils.adminMaterials.get.invalidate({ materialId });
  };

  const updateCard = trpc.adminMaterials.updateCard.useMutation({ onSuccess: invalidateCards });
  const deleteCard = trpc.adminMaterials.deleteCard.useMutation({ onSuccess: invalidateCards });
  const bulkApprove = trpc.adminMaterials.bulkApproveCards.useMutation({
    onSuccess: () => {
      invalidateCards();
      setSelected(new Set());
    },
  });
  const bulkDelete = trpc.adminMaterials.bulkDeleteCards.useMutation({
    onSuccess: () => {
      invalidateCards();
      setSelected(new Set());
    },
  });
  const publish = trpc.adminMaterials.publish.useMutation({
    onSuccess: () => utils.adminMaterials.get.invalidate({ materialId }),
  });

  function toggleSelected(cardId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function setField(cardId: string, field: string, value: string) {
    setEditing(prev => ({
      ...prev,
      [cardId]: { ...prev[cardId], [field]: value },
    }));
  }

  function saveCard(cardId: string) {
    const fields = editing[cardId];
    if (!fields) return;
    updateCard.mutate({ cardId, ...fields });
  }

  const material = materialQuery.data?.material;
  const cards = cardsQuery.data ?? [];

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <Link href="/admin/materials/list" className="eyebrow" style={{ marginBottom: 8 }}>
            <span className="eyebrow-dot" /> ‹ رجوع لكل الملفات
          </Link>
          <h1>{material?.title ?? "مراجعة البطاقات"}</h1>
          <p>
            {material?.pageCount ?? 0} صفحة · {cards.length} بطاقة معروضة ·
            الحالة: {material?.status ?? "..."}
          </p>
        </div>
        <div className="header-actions">
          {material?.status === "ready_for_review" && (
            <button
              type="button"
              className="primary-button"
              disabled={publish.isPending}
              onClick={() => publish.mutate({ materialId })}
            >
              <Send size={16} /> نشر المادة
            </button>
          )}
        </div>
      </div>

      {publish.isSuccess && (
        <div className="inline-alert success wide">
          <CheckCircle2 size={16} /> تم نشر المادة للطلاب.
        </div>
      )}

      <div className="cards-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="search-box">
          <span>⌕</span>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="ابحث في نص البطاقات..."
          />
        </div>
        <select
          className="text-input"
          style={{ width: "auto" }}
          value={reviewStatus}
          onChange={event => setReviewStatus(event.target.value as ReviewStatusFilter)}
        >
          <option value="all">كل حالات المراجعة</option>
          <option value="pending">بانتظار المراجعة</option>
          <option value="approved">معتمدة</option>
          <option value="needs_review">تحتاج مراجعة</option>
        </select>
        <select
          className="text-input"
          style={{ width: "auto" }}
          value={confidence}
          onChange={event => setConfidence(event.target.value as ConfidenceFilter)}
        >
          <option value="all">كل مستويات الثقة</option>
          <option value="high">ثقة عالية</option>
          <option value="medium">ثقة متوسطة</option>
          <option value="low">ثقة منخفضة</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="inline-alert warning wide">
          <span>{selected.size} بطاقة محددة</span>
          <button
            type="button"
            className="secondary-button"
            style={{ marginRight: 10 }}
            disabled={bulkApprove.isPending}
            onClick={() => bulkApprove.mutate({ cardIds: Array.from(selected) })}
          >
            اعتماد المحدد
          </button>
          <button
            type="button"
            className="secondary-button"
            style={{ marginRight: 10 }}
            disabled={bulkDelete.isPending}
            onClick={() => {
              if (confirm(`حذف ${selected.size} بطاقة؟`)) {
                bulkDelete.mutate({ cardIds: Array.from(selected) });
              }
            }}
          >
            حذف المحدد
          </button>
        </div>
      )}

      {cardsQuery.isLoading ? (
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري التحميل...</h3>
        </div>
      ) : !cards.length ? (
        <div className="empty-state">
          <h3>لا توجد بطاقات مطابقة</h3>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {cards.map(card => (
            <div key={card.id} className="panel-card" style={{ padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={selected.has(card.id)}
                    onChange={() => toggleSelected(card.id)}
                  />
                  <span style={{ fontSize: 11, color: "#8d9895" }}>
                    صفحة {card.sourcePage} · ثقة {card.confidence} ·{" "}
                    {card.reviewStatus === "approved" ? (
                      <span style={{ color: "#5d9b78" }}>معتمدة</span>
                    ) : card.reviewStatus === "needs_review" ? (
                      <span style={{ color: "#c8544d" }}>تحتاج مراجعة</span>
                    ) : (
                      "بانتظار المراجعة"
                    )}
                  </span>
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {card.reviewStatus !== "approved" && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => bulkApprove.mutate({ cardIds: [card.id] })}
                    >
                      اعتماد
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      if (confirm("حذف هذه البطاقة؟")) deleteCard.mutate({ cardId: card.id });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={updateCard.isPending}
                    onClick={() => saveCard(card.id)}
                  >
                    حفظ
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <textarea
                  className="text-input"
                  rows={2}
                  defaultValue={card.questionEn}
                  onChange={event => setField(card.id, "questionEn", event.target.value)}
                  placeholder="السؤال (EN)"
                />
                <textarea
                  className="text-input"
                  rows={2}
                  defaultValue={card.questionAr}
                  onChange={event => setField(card.id, "questionAr", event.target.value)}
                  placeholder="السؤال (AR)"
                />
                <textarea
                  className="text-input"
                  rows={2}
                  defaultValue={card.answerEn}
                  onChange={event => setField(card.id, "answerEn", event.target.value)}
                  placeholder="الإجابة (EN)"
                />
                <textarea
                  className="text-input"
                  rows={2}
                  defaultValue={card.answerAr}
                  onChange={event => setField(card.id, "answerAr", event.target.value)}
                  placeholder="الإجابة (AR)"
                />
                <textarea
                  className="text-input"
                  rows={2}
                  defaultValue={card.explanationEn}
                  onChange={event => setField(card.id, "explanationEn", event.target.value)}
                  placeholder="الشرح (EN)"
                />
                <textarea
                  className="text-input"
                  rows={2}
                  defaultValue={card.explanationAr}
                  onChange={event => setField(card.id, "explanationAr", event.target.value)}
                  placeholder="الشرح (AR)"
                />
                <input
                  className="text-input"
                  defaultValue={card.keyIdeaEn}
                  onChange={event => setField(card.id, "keyIdeaEn", event.target.value)}
                  placeholder="الفكرة الأساسية (EN)"
                />
                <input
                  className="text-input"
                  defaultValue={card.keyIdeaAr}
                  onChange={event => setField(card.id, "keyIdeaAr", event.target.value)}
                  placeholder="الفكرة الأساسية (AR)"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
