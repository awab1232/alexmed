"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Network,
  Sparkles,
  Target,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";

const ASSET_TYPE_LABEL_AR: Record<string, string> = {
  image: "صورة",
  diagram: "مخطط",
  table: "جدول",
  screenshot: "لقطة",
  chart: "رسم بياني",
};

export default function BookMindMapPage() {
  const params = useParams<{ bookId: string }>();
  const mapQuery = trpc.books.getMindMap.useQuery({ id: params.bookId });
  const utils = trpc.useUtils();
  const generateSections = trpc.books.generateMindMapSections.useMutation({
    onSuccess: () => utils.books.getMindMap.invalidate({ id: params.bookId }),
  });
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

  const chapters = mapQuery.data?.chapters ?? [];
  const totals = useMemo(() => {
    const sections = chapters.reduce((n, c) => n + (c.mindMapSections?.length ?? 0), 0);
    const concepts = chapters.reduce((n, c) => n + (c.mindMapSections ?? []).reduce((m, s) => m + (s.concepts?.length ?? 0), 0), 0);
    const points = chapters.reduce((n, c) => n + (c.mindMapSections ?? []).reduce((m, s) => m + (s.examPoints?.length ?? 0), 0), 0);
    return { sections, concepts, points };
  }, [chapters]);

  function toggleChapter(id: string) {
    setOpenChapters(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (mapQuery.isLoading) return <section className="upload-view"><div className="empty-state"><Loader2 size={28} className="spin" /><h3>جاري بناء مساحة الخريطة...</h3></div></section>;
  if (mapQuery.isError || !mapQuery.data) return <section className="upload-view"><div className="empty-state"><CircleAlert size={28} /><h3>تعذر تحميل الخريطة الذهنية</h3></div></section>;

  return (
    <section className="cards-view mindmap-page">
      <div className="mindmap-hero">
        <div>
          <Link href={`/books/${params.bookId}`} className="eyebrow"><span className="eyebrow-dot green" /> رجوع إلى الكتاب</Link>
          <h1><span className="mindmap-title-icon"><BrainCircuit size={27} /></span> الخريطة الذهنية</h1>
          <p>خريطة دراسية مرتبطة بالملخص، المصطلحات، البطاقات، وأسئلة الاختبار.</p>
          <div className="mindmap-hero-meta"><BookOpen size={14} /> {mapQuery.data.book.fileName}</div>
        </div>
        <div className="mindmap-hero-art"><Network size={76} strokeWidth={1.2} /><span>Understand the whole picture</span></div>
      </div>

      <div className="mindmap-stats">
        <div><span>Chapters</span><strong>{chapters.length}</strong><small>الفصول الجاهزة</small></div>
        <div><span>Branches</span><strong>{totals.sections}</strong><small>الأقسام الرئيسية</small></div>
        <div><span>Concepts</span><strong>{totals.concepts}</strong><small>المفاهيم المرتبطة</small></div>
        <div><span>Exam points</span><strong>{totals.points}</strong><small>نقاط عالية العائد</small></div>
      </div>

      <div className="mindmap-legend">
        <span><i className="legend-dot orange" /> Summary</span>
        <span><i className="legend-dot green" /> Concepts</span>
        <span><i className="legend-dot gold" /> Exam focus</span>
        <span><i className="legend-dot blue" /> Recall prompts</span>
      </div>

      {!chapters.length ? (
        <div className="empty-state"><Layers3 size={28} /><h3>لا توجد فصول مكتملة بعد</h3><p>ستظهر الخريطة تلقائيًا بعد اكتمال تحليل الكتاب.</p></div>
      ) : (
        <div className="mindmap-chapters">
          {chapters.map((chapter, chapterIndex) => {
            const isOpen = openChapters.has(chapter.id);
            const sections = chapter.mindMapSections ?? [];
            const generating = generateSections.isPending && generateSections.variables?.chapterId === chapter.id;
            return (
              <article className={`mindmap-chapter ${isOpen ? "is-open" : ""}`} key={chapter.id}>
                <button type="button" className="mindmap-chapter-head" onClick={() => toggleChapter(chapter.id)}>
                  <span className="mindmap-chapter-number">{String(chapterIndex + 1).padStart(2, "0")}</span>
                  <span className="mindmap-chapter-main"><strong>{chapter.title}</strong><small>{sections.length ? `${sections.length} branches · ${chapter.keyPoints?.length ?? 0} high-yield points` : "Ready to generate"}</small></span>
                  <span className="mindmap-chapter-action">{sections.length ? (isOpen ? <ChevronDown size={18} /> : <ChevronLeft size={18} />) : <Sparkles size={17} />}</span>
                </button>
                {!sections.length && (
                  <div className="mindmap-generate-row"><p>اربط الشرح الإنجليزي والعربي بالمصطلحات والبطاقات والأسئلة في خريطة واحدة.</p><button type="button" className="primary-button" disabled={generating} onClick={() => generateSections.mutate({ chapterId: chapter.id })}>{generating ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} {generating ? "جاري البناء..." : "بناء الخريطة"}</button></div>
                )}
                {isOpen && !!sections.length && (
                  <div className="mindmap-branches">
                    <div className="mindmap-root"><span><BrainCircuit size={17} /></span><div><strong>{chapter.title}</strong><small>Chapter map / خريطة الفصل</small></div></div>
                    <div className="mindmap-branch-grid">
                      {sections.map((section, index) => (
                        <section className="mindmap-branch" key={`${chapter.id}-${index}`}>
                          <div className="mindmap-branch-title"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{section.title}</strong><small>{section.sourcePages?.length ? `Pages ${section.sourcePages.join(", ")}` : "Source-linked branch"}</small></div></div>
                          {section.summaryEn && <p className="mindmap-english" dir="ltr">{section.summaryEn}</p>}
                          {section.explanationAr && <p className="mindmap-arabic" dir="rtl">{section.explanationAr}</p>}
                          {!!section.concepts?.length && <div className="mindmap-concepts"><span className="mindmap-label"><Layers3 size={12} /> Concepts / المفاهيم</span>{section.concepts.map((concept, i) => <div className="mindmap-concept" key={i}><strong className="en" dir="ltr">{concept.termEn}</strong><span>{concept.termAr}</span>{concept.explanationEn && <p className="en" dir="ltr">{concept.explanationEn}</p>}{concept.explanationAr && <p>{concept.explanationAr}</p>}</div>)}</div>}
                          {!!section.examPoints?.length && <div className="mindmap-exam"><span className="mindmap-label"><Target size={12} /> Exam focus / نقاط الامتحان</span>{section.examPoints.map((point, i) => <div key={i}><b>{i + 1}</b>{point}</div>)}</div>}
                          {!!section.cardPrompts?.length && <div className="mindmap-prompts"><span className="mindmap-label"><FileText size={12} /> Recall prompts / أسئلة الاستدعاء</span>{section.cardPrompts.map((prompt, i) => <div key={i}><ChevronRight size={12} />{prompt}</div>)}</div>}
                        </section>
                      ))}
                    </div>
                    <div className="mindmap-chapter-footer"><Link href={`/books/${params.bookId}/chapters/${chapter.id}?tool=explanation`}>فتح الملخص <ArrowLeft size={14} /></Link><Link href={`/books/${params.bookId}/chapters/${chapter.id}?tool=cards`}>فتح البطاقات <ArrowLeft size={14} /></Link></div>
                  </div>
                )}
                {isOpen && !!chapter.keyPoints?.length && !sections.length && <div className="mindmap-fallback-points"><span className="mindmap-label">High-Yield / أهم النقاط</span>{chapter.keyPoints.map((point, i) => <div key={i}><b>{i + 1}</b>{point}</div>)}</div>}
                {isOpen && !!chapter.visuals?.length && <div className="mindmap-visuals"><span className="mindmap-label"><ImageIcon size={12} /> Visual anchors / الصور والمخططات</span>{chapter.visuals.map((visual, i) => <div key={i}><ImageIcon size={12} /> <b>{ASSET_TYPE_LABEL_AR[visual.assetType] ?? visual.assetType}</b> · page {visual.pageNumber}{visual.descriptionEn ? ` — ${visual.descriptionEn}` : ""}</div>)}</div>}
              </article>
            );
          })}
        </div>
      )}

      <div className="mindmap-footer-note"><Sparkles size={15} /><span>الخريطة لا تستبدل الملخص؛ هي تعيد تنظيمه مع البطاقات والأسئلة حتى ترى الصورة الكاملة وتعرف أين تراجع.</span></div>
    </section>
  );
}
