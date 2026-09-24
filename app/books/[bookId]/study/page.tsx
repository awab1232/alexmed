"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import QuizMode from "@/components/study/QuizMode";
import FlashcardsMode from "@/components/study/FlashcardsMode";
import SummaryMode from "@/components/study/SummaryMode";
import StudyShell from "@/components/study/StudyShell";

type Tool = "cards" | "mcqs" | "explanation";

// Studying the WHOLE file, not its first chapter. The book page's
// بطاقات / اختبار / ملخص used to open only the first chapter (pages 1–8 of a
// fixed-window split — usually the lecturer/objectives pages), which is
// exactly the "questions about the doctor instead of the material" bug.
// This page gathers every chapter's content in page order, generates the
// on-demand cards/MCQs for any chapter that doesn't have them yet (one
// chapter at a time, with visible progress), and shows the real coverage —
// never a silent "complete".
export default function BookStudyPage() {
  const params = useParams<{ bookId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookId = params.bookId;
  const rawTool = searchParams.get("tool");
  const tool: Tool =
    rawTool === "mcqs" || rawTool === "explanation" ? rawTool : "cards";

  const utils = trpc.useUtils();
  const contentQuery = trpc.books.getStudyContent.useQuery({ bookId });
  const generateFlashcards = trpc.books.generateChapterFlashcards.useMutation();
  const generateMcqs = trpc.books.generateChapterMcqs.useMutation();
  const submitMcqAttempt = trpc.books.submitMcqAttempt.useMutation();
  const rateCard = trpc.books.rateCard.useMutation();
  const composeNotes = trpc.books.generateMedicalNotePages.useMutation({
    onSuccess: () => utils.books.getStudyContent.invalidate({ bookId }),
  });

  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    current: string;
    errors: string[];
  } | null>(null);
  const startedRef = useRef(false);

  const data = contentQuery.data;
  const analyzed = data?.chapters.filter(c => c.status === "complete") ?? [];

  // Generate cards/MCQs for every analyzed chapter still missing them —
  // sequentially (each call is itself chunked over every page server-side).
  useEffect(() => {
    if (!data || startedRef.current || tool === "explanation") return;
    const have = new Set(
      (tool === "cards" ? data.cards : data.mcqs).map(item => item.chapterId)
    );
    const missing = analyzed.filter(chapter => !have.has(chapter.id));
    if (!missing.length) return;
    startedRef.current = true;
    (async () => {
      const errors: string[] = [];
      for (let i = 0; i < missing.length; i++) {
        setProgress({
          done: i,
          total: missing.length,
          current: missing[i].title,
          errors,
        });
        try {
          const mutation = tool === "cards" ? generateFlashcards : generateMcqs;
          await mutation.mutateAsync({ chapterId: missing[i].id });
        } catch {
          errors.push(missing[i].title);
        }
      }
      await utils.books.getStudyContent.invalidate({ bookId });
      setProgress(
        errors.length
          ? { done: missing.length, total: missing.length, current: "", errors }
          : null
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tool]);

  const back = () => router.push(`/books/${bookId}`);

  if (contentQuery.isLoading || !data) {
    return (
      <StudyShell title="جاري التحميل" onBack={back}>
        <div className="study-empty">
          {contentQuery.error ? (
            <>
              <CircleAlert size={28} />
              <h3>تعذر تحميل محتوى الملف</h3>
            </>
          ) : (
            <Loader2 size={28} className="spin" />
          )}
        </div>
      </StudyShell>
    );
  }

  const title = data.book.fileName.replace(/\.pdf$/i, "");
  const manifest = data.manifest;
  const subtitle = `الملف كاملاً · ${manifest.totalPages} صفحة · ${data.chapters.length} أجزاء`;
  const outputKind =
    tool === "cards" ? "flashcards" : tool === "mcqs" ? "mcqs" : "summary";
  const output = manifest.outputs[outputKind];

  // Honest coverage line — shows exactly what was read, analyzed and
  // generated from; a warning style whenever anything is short of 100%.
  const warn =
    manifest.extractedPages < manifest.totalPages ||
    analyzed.length < data.chapters.length ||
    (!!output && (output.status === "PARTIAL" || output.status === "FAILED")) ||
    !!progress?.errors.length;
  const notice = (
    <span className={warn ? "study-coverage is-warn" : "study-coverage"}>
      قُرئت {manifest.extractedPages}/{manifest.totalPages} صفحة · حُلّل{" "}
      {analyzed.length}/{data.chapters.length} أجزاء
      {output && output.requiredChunks > 0 && (
        <>
          {" "}
          · التغطية {output.coveredChunks}/{output.requiredChunks} مقاطع
        </>
      )}
      {!!manifest.failedPages.length && (
        <> · تعذّرت قراءة الصفحات {manifest.failedPages.join("، ")}</>
      )}
      {!!progress?.errors.length && (
        <> · فشل التوليد لـ: {progress.errors.join("، ")}</>
      )}
    </span>
  );

  if (progress && progress.done < progress.total) {
    return (
      <StudyShell
        title={title}
        subtitle={subtitle}
        onBack={back}
        notice={notice}
      >
        <div className="study-empty">
          <Loader2 size={28} className="spin" />
          <h3>
            {tool === "cards" ? "توليد البطاقات" : "توليد الأسئلة"} من الملف
            كاملاً
          </h3>
          <p>
            الجزء {progress.done + 1} من {progress.total}: {progress.current}
          </p>
          <div className="flash-progress-track" style={{ width: "70%" }}>
            <i
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      </StudyShell>
    );
  }

  const termsByChapter = new Map<string, { en: string; ar: string }[]>();
  for (const term of data.terms) {
    termsByChapter.set(term.chapterId, [
      ...(termsByChapter.get(term.chapterId) ?? []),
      term,
    ]);
  }
  const aiTarget = { scope: "book" as const, bookId };
  const regenerate = () => {
    startedRef.current = false;
    utils.books.getStudyContent.invalidate({ bookId });
  };

  if (tool === "mcqs") {
    return (
      <QuizMode
        title={title}
        subtitle={subtitle}
        notice={notice}
        aiTarget={aiTarget}
        mcqs={data.mcqs.map(mcq => ({
          id: mcq.id,
          questionEn: mcq.questionEn,
          choices: mcq.choices as string[],
          correctIndex: mcq.correctIndex,
          explanationEn: mcq.explanationEn,
          validationStatus: mcq.validationStatus,
          validationNote: mcq.validationNote,
          sourcePage: mcq.sourcePage,
        }))}
        onBack={back}
        onSubmit={(mcqId, selectedIndex) =>
          submitMcqAttempt.mutateAsync({ mcqId, selectedIndex })
        }
        onGenerate={regenerate}
        generating={false}
      />
    );
  }

  if (tool === "cards") {
    return (
      <FlashcardsMode
        title={title}
        subtitle={subtitle}
        notice={notice}
        aiTarget={aiTarget}
        bookId={bookId}
        cards={data.cards.map(card => ({
          id: card.id,
          questionEn: card.questionEn,
          questionAr: card.questionAr,
          answerEn: card.answerEn,
          answerAr: card.answerAr,
          relatedTermEn: card.relatedTermEn,
          relatedTermAr: termsByChapter
            .get(card.chapterId)
            ?.find(
              term =>
                term.en.toLowerCase() === card.relatedTermEn?.toLowerCase()
            )?.ar,
          sourcePage: card.sourcePage,
        }))}
        onBack={back}
        onRate={(cardId, rating) => rateCard.mutate({ cardId, rating })}
        onGenerate={regenerate}
        generating={false}
      />
    );
  }

  return (
    <SummaryMode
      bookTitle={title}
      subtitle={subtitle}
      notice={notice}
      aiTarget={aiTarget}
      chapters={analyzed.map(chapter => ({
        id: chapter.id,
        title: chapter.title,
        startPage: chapter.startPage,
        endPage: chapter.endPage,
        chapterSummary: chapter.chapterSummary,
        explanationEn: chapter.explanationEn,
        explanationAr: chapter.explanationAr,
        keyPoints: chapter.keyPoints,
        medicalNotePages: chapter.medicalNotePages,
        summarySections: chapter.coverageManifest?.summarySections,
      }))}
      onBack={back}
      onComposeNotes={chapterId => composeNotes.mutate({ chapterId })}
      composingChapterId={
        composeNotes.isPending
          ? (composeNotes.variables?.chapterId ?? null)
          : null
      }
    />
  );
}
