"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Loader2, RotateCcw, WifiOff, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import {
  scoreQuizStage,
  type QuizAnswer,
  type QuizQuestion,
} from "@/lib/brain-games/games";
import type { StageResult } from "@/lib/db-brain-games";

type Phase = "ready" | "question" | "feedback" | "submitting" | "error";

type Saved = {
  index: number;
  answers: QuizAnswer[];
  // When the current question was shown (epoch ms) — the deadline is
  // always shownAt + limit, so a refresh or a slow device never grants
  // extra time.
  shownAt: number | null;
};

const storageKey = (sessionId: string) => `bg-quiz-${sessionId}`;

function load(sessionId: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(sessionId: string, state: Saved) {
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode) — the stage still plays.
  }
}

export function clearQuizState(sessionId: string) {
  try {
    localStorage.removeItem(storageKey(sessionId));
  } catch {
    // ignore
  }
}

function initialPhase(saved: Saved | null, total: number): Phase {
  if (!saved) return "ready";
  if (saved.answers.length >= total) return "submitting";
  // Refreshed right after answering: show that answer's feedback, never
  // let the same question be answered twice.
  if (saved.answers[saved.index]) return "feedback";
  return saved.shownAt ? "question" : "ready";
}

const OPTION_KEYS = ["A", "B", "C", "D"];

export default function QuizPlayer({
  sessionId,
  stage,
  questions,
  passCorrect,
  autoAdvance,
  onFinished,
  onRestart,
}: {
  sessionId: string;
  stage: number;
  questions: QuizQuestion[];
  passCorrect: number;
  // Math games move on by themselves; General Knowledge waits so the
  // explanation can be read.
  autoAdvance: boolean;
  onFinished: (result: StageResult) => void;
  onRestart: () => void;
}) {
  const initial = useMemo<Saved | null>(() => load(sessionId), [sessionId]);
  const [index, setIndex] = useState(initial?.index ?? 0);
  const [answers, setAnswers] = useState<QuizAnswer[]>(initial?.answers ?? []);
  const [shownAt, setShownAt] = useState<number | null>(
    initial?.shownAt ?? null
  );
  const [phase, setPhase] = useState<Phase>(() =>
    initialPhase(initial, questions.length)
  );
  const [now, setNow] = useState(() => Date.now());
  const [errorMessage, setErrorMessage] = useState("");
  const [errorKind, setErrorKind] = useState<"network" | "expired" | "other">(
    "other"
  );
  const submitted = useRef(false);
  const submit = trpc.brainGames.submitQuiz.useMutation();

  const question = questions[index];
  const lastAnswer = answers[index];
  const deadline = shownAt && question ? shownAt + question.timeLimitMs : 0;
  const remainingMs = Math.max(0, deadline - now);

  const persist = useCallback(
    (next: Saved) => save(sessionId, next),
    [sessionId]
  );

  const record = useCallback(
    (choice: number | null, at: number) => {
      if (phase !== "question" || !question || !shownAt) return;
      const timeMs =
        choice === null
          ? question.timeLimitMs
          : Math.min(at - shownAt, question.timeLimitMs);
      const nextAnswers = [...answers];
      nextAnswers[index] = { choice, timeMs };
      setAnswers(nextAnswers);
      setPhase("feedback");
      persist({ index, answers: nextAnswers, shownAt });
    },
    [phase, question, shownAt, answers, index, persist]
  );

  const doSubmit = useCallback(
    (finalAnswers: QuizAnswer[]) => {
      if (submitted.current) return;
      submitted.current = true;
      setPhase("submitting");
      submit.mutate(
        { sessionId, answers: finalAnswers },
        {
          onSuccess: result => {
            clearQuizState(sessionId);
            onFinished(result);
          },
          onError: error => {
            submitted.current = false;
            const code = error.data?.code;
            setErrorKind(
              !code || code === "INTERNAL_SERVER_ERROR"
                ? "network"
                : code === "PRECONDITION_FAILED" || code === "CONFLICT"
                  ? "expired"
                  : "other"
            );
            setErrorMessage(error.message);
            setPhase("error");
          },
        }
      );
    },
    [sessionId, submit, onFinished]
  );

  const next = useCallback(() => {
    const nextIndex = index + 1;
    if (nextIndex >= questions.length) {
      persist({ index: nextIndex, answers, shownAt: null });
      setIndex(nextIndex);
      doSubmit(answers);
      return;
    }
    const at = Date.now();
    setIndex(nextIndex);
    setShownAt(at);
    setNow(at);
    setPhase("question");
    persist({ index: nextIndex, answers, shownAt: at });
  }, [index, questions.length, answers, persist, doSubmit]);

  const begin = useCallback(() => {
    const at = Date.now();
    setShownAt(at);
    setNow(at);
    setPhase("question");
    persist({ index, answers, shownAt: at });
  }, [index, answers, persist]);

  // Resume: a stored attempt whose answers are all in goes straight to
  // (re)submitting — the server is idempotent, so this is always safe.
  useEffect(() => {
    if (phase === "submitting" && !submitted.current) doSubmit(answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown from the absolute deadline; at 0 the question locks as a
  // timeout (also right after a refresh if the deadline already passed).
  useEffect(() => {
    if (phase !== "question") return;
    let frame = 0;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (deadline && t >= deadline) {
        record(null, t);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, deadline, record]);

  // Auto-advance after feedback (math games).
  useEffect(() => {
    if (phase !== "feedback" || !autoAdvance) return;
    const timer = setTimeout(next, 850);
    return () => clearTimeout(timer);
  }, [phase, autoAdvance, next]);

  // Retry a failed submit as soon as the connection comes back.
  useEffect(() => {
    if (phase !== "error" || errorKind !== "network") return;
    const retry = () => doSubmit(answers);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [phase, errorKind, answers, doSubmit]);

  // Keyboard: 1–4 / A–D pick an option, Enter continues.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (phase === "question" && question) {
        const n = "1234".indexOf(event.key);
        const letter = "abcd".indexOf(event.key.toLowerCase());
        const pick = n >= 0 ? n : letter;
        if (pick >= 0 && pick < question.options.length) {
          record(pick, Date.now());
        }
      } else if (phase === "feedback" && event.key === "Enter") {
        next();
      } else if (phase === "ready" && event.key === "Enter") {
        begin();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, question, record, next, begin]);

  // Running score = points earned so far. The perfect-stage bonus is only
  // decided at the end (by the server), never shown mid-stage.
  const liveScore = scoreQuizStage(
    questions.slice(0, answers.length),
    answers,
    passCorrect
  ).perQuestion.reduce((sum, q) => sum + q.points, 0);

  if (phase === "ready") {
    const limit = Math.round((questions[0]?.timeLimitMs ?? 8000) / 1000);
    return (
      <div className="bg-ready">
        <span className="bg-ready-stage">المستوى {stage}</span>
        <h2>{index > 0 ? "جاهز تكمل؟" : "جاهز؟"}</h2>
        <ul>
          <li>{questions.length} أسئلة</li>
          <li>{limit} ثوانٍ لكل سؤال</li>
          <li>تحتاج {passCorrect} إجابات صحيحة لفتح المستوى التالي</li>
        </ul>
        <button type="button" className="bg-primary-lg" onClick={begin}>
          {index > 0 ? `▶ أكمل من السؤال ${index + 1}` : "▶ ابدأ"}
        </button>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div className="bg-state" aria-live="polite">
        <Loader2 size={28} className="spin" aria-hidden="true" />
        <p>نحسب نتيجتك…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="bg-state" role="alert">
        {errorKind === "network" && <WifiOff size={28} aria-hidden="true" />}
        <h2>
          {errorKind === "network"
            ? "انقطع الاتصال"
            : errorKind === "expired"
              ? "انتهت هذه الجلسة"
              : "تعذر حفظ النتيجة"}
        </h2>
        <p>
          {errorKind === "network"
            ? "إجاباتك محفوظة على جهازك، وسنرسلها تلقائيًا عند عودة الاتصال."
            : errorMessage}
        </p>
        {errorKind === "expired" ? (
          <button type="button" className="primary-button" onClick={onRestart}>
            <RotateCcw size={16} aria-hidden="true" /> ابدأ المستوى من جديد
          </button>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={() => doSubmit(answers)}
          >
            <RotateCcw size={16} aria-hidden="true" /> إعادة المحاولة
          </button>
        )}
      </div>
    );
  }

  if (!question) return null;
  const limitMs = question.timeLimitMs;
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const timedOut = phase === "feedback" && lastAnswer?.choice === null;
  const wasCorrect =
    phase === "feedback" && lastAnswer?.choice === question.correctIndex;

  return (
    <div className="bg-quiz">
      <div className="bg-quiz-top">
        <span>
          سؤال{" "}
          <bdi dir="ltr">
            {index + 1}/{questions.length}
          </bdi>
        </span>
        <span aria-label={`النقاط ${liveScore}`}>⭐ {liveScore}</span>
      </div>
      <div
        className={`bg-timer ${secondsLeft <= 2 && phase === "question" ? "is-low" : ""}`}
        role="timer"
        aria-label={`الوقت المتبقي ${secondsLeft} ثانية`}
      >
        <Clock size={16} aria-hidden="true" />
        <strong>{phase === "question" ? secondsLeft : "—"}</strong>
        <span className="bg-timer-bar">
          <span
            style={{
              width: `${phase === "question" ? (remainingMs / limitMs) * 100 : 0}%`,
            }}
          />
        </span>
      </div>

      <div className="bg-question" key={question.id}>
        {question.category && (
          <span className="bg-question-cat">{question.category}</span>
        )}
        {question.instruction && (
          <span className="bg-question-instruction">
            {question.instruction}
          </span>
        )}
        <h2 dir="auto">{question.prompt}</h2>
      </div>

      <div className="bg-options" role="group" aria-label="الخيارات">
        {question.options.map((option, i) => {
          const chosen = lastAnswer?.choice === i;
          const isAnswer = i === question.correctIndex;
          const state =
            phase !== "feedback"
              ? ""
              : isAnswer
                ? "is-correct"
                : chosen
                  ? "is-wrong"
                  : "is-dim";
          return (
            <button
              key={i}
              type="button"
              className={`bg-option ${state}`}
              disabled={phase !== "question"}
              onClick={() => record(i, Date.now())}
              aria-label={`${OPTION_KEYS[i]}: ${option}${
                phase === "feedback" && isAnswer
                  ? " — الإجابة الصحيحة"
                  : phase === "feedback" && chosen
                    ? " — إجابتك"
                    : ""
              }`}
            >
              <span className="bg-option-key" aria-hidden="true">
                {OPTION_KEYS[i]}
              </span>
              <span dir="auto">{option}</span>
              {phase === "feedback" && isAnswer && (
                <Check size={18} aria-hidden="true" />
              )}
              {phase === "feedback" && chosen && !isAnswer && (
                <X size={18} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {phase === "feedback" && (
        <div
          className={`bg-feedback ${wasCorrect ? "is-correct" : "is-wrong"}`}
          aria-live="assertive"
        >
          <strong>
            {wasCorrect ? "✓ صحيح" : timedOut ? "⏱ انتهى الوقت" : "✗ خطأ"}
          </strong>
          {question.explanation && <p>{question.explanation}</p>}
          {!autoAdvance && (
            <button type="button" className="bg-primary-lg" onClick={next}>
              {index + 1 >= questions.length ? "النتيجة" : "التالي ←"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
