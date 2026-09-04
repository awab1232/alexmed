"use client";

import { BarChart3, CircleAlert, Clock, Flame } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

export default function StatsPage() {
  const statsQuery = trpc.books.stats.useQuery();
  const stats = statsQuery.data;

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> إحصائياتي
          </div>
          <h1>
            تقدمك <em>بالأرقام.</em>
          </h1>
          <p>نظرة سريعة على مراجعتك ودقّتك.</p>
        </div>
      </div>

      {statsQuery.isError ? (
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>تعذر تحميل الإحصائيات</h3>
          <p>تحقق من اتصالك وحاول مرة أخرى.</p>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: 14 }}
            onClick={() => statsQuery.refetch()}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : statsQuery.isLoading || !stats ? (
        <div className="empty-state">
          <BarChart3 size={28} />
          <h3>جاري تحميل إحصائياتك...</h3>
        </div>
      ) : (
        <div
          className="stats-row"
          style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
        >
          <div className="stat-card">
            <span>بطاقات تمت مراجعتها</span>
            <strong>{stats.cardsReviewed}</strong>
            <small>إجمالي المراجعات</small>
          </div>
          <div className="stat-card accent">
            <span>نسبة الإجابات الصحيحة</span>
            <strong>{stats.accuracyPercent}%</strong>
            <small>من الأسئلة اللي جاوبت عليها</small>
          </div>
          <div className="stat-card">
            <span>
              <Flame size={13} style={{ verticalAlign: "-2px" }} /> سلسلة الأيام
            </span>
            <strong>{stats.streakDays}</strong>
            <small>يوم متواصل</small>
          </div>
          <div className="stat-card">
            <span>
              <Clock size={13} style={{ verticalAlign: "-2px" }} /> ساعات
              الدراسة
            </span>
            <strong>{stats.hoursStudied}</strong>
            <small>ساعة تقريبًا</small>
          </div>
        </div>
      )}
    </section>
  );
}
