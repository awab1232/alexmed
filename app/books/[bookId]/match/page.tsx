"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import StudyShell from "@/components/study/StudyShell";
import {
  buildMatchPairs,
  buildMatchTiles,
  isMatch,
  MISMATCH_PENALTY_MS,
  type MatchTile,
} from "@/lib/match-game";

const PAIRS_PER_ROUND = 6; // 12 tiles — a 3×4 grid like Quizlet's match

function formatSeconds(ms: number) {
  return (ms / 1000).toFixed(1);
}

// Quizlet-style match game over this file's own flashcards (and terms):
// tap a question then its answer — a correct pair disappears, a wrong one
// flashes red and costs a second. Clear the board as fast as possible.
export default function MatchGamePage() {
  const params = useParams<{ bookId: string }>();
  const router = useRouter();
  const bookId = params.bookId;
  const contentQuery = trpc.books.getStudyContent.useQuery({ bookId });

  const [round, setRound] = useState(0);
  const [tiles, setTiles] = useState<MatchTile[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<MatchTile | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [penaltyMs, setPenaltyMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const bestKey = `match-best-${bookId}`;

  const data = contentQuery.data;
  const pairsAvailable = useMemo(
    () =>
      data
        ? buildMatchPairs(data.cards, data.terms, PAIRS_PER_ROUND).length
        : 0,
    [data]
  );

  const startRound = useCallback(() => {
    if (!data) return;
    const pairs = buildMatchPairs(data.cards, data.terms, PAIRS_PER_ROUND);
    setTiles(buildMatchTiles(pairs));
    setMatched(new Set());
    setSelected(null);
    setWrong([]);
    setPenaltyMs(0);
    setFinishedMs(null);
    setStartedAt(Date.now());
    setNow(Date.now());
  }, [data]);

  useEffect(() => {
    if (data) startRound();
  }, [data, round, startRound]);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(bestKey));
      if (saved > 0) setBest(saved);
    } catch {
      // Storage unavailable — no best time, game still works.
    }
  }, [bestKey]);

  // Live clock while playing.
  useEffect(() => {
    if (startedAt === null || finishedMs !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [startedAt, finishedMs]);

  useEffect(() => () => clearTimeout(wrongTimer.current), []);

  function tap(tile: MatchTile) {
    if (finishedMs !== null || matched.has(tile.id) || wrong.length) return;
    if (!selected) {
      setSelected(tile);
      return;
    }
    if (selected.id === tile.id) {
      setSelected(null);
      return;
    }
    if (isMatch(selected, tile)) {
      const next = new Set(matched);
      next.add(selected.id);
      next.add(tile.id);
      setMatched(next);
      setSelected(null);
      if (next.size === tiles.length && startedAt !== null) {
        const total = Date.now() - startedAt + penaltyMs;
        setFinishedMs(total);
        if (!best || total < best) {
          setBest(total);
          try {
            localStorage.setItem(bestKey, String(total));
          } catch {
            // Ignore storage failures.
          }
        }
      }
      return;
    }
    // Wrong pair: flash both red for a moment, add the penalty.
    setWrong([selected.id, tile.id]);
    setPenaltyMs(p => p + MISMATCH_PENALTY_MS);
    setSelected(null);
    clearTimeout(wrongTimer.current);
    wrongTimer.current = setTimeout(() => setWrong([]), 550);
  }

  const elapsed =
    finishedMs ??
    (startedAt === null ? 0 : Math.max(0, now - startedAt) + penaltyMs);
  const back = () => router.push(`/books/${bookId}`);

  if (contentQuery.isLoading || !data) {
    return (
      <StudyShell title="لعبة المطابقة" onBack={back}>
        <div className="study-empty">
          <Loader2 size={28} className="spin" />
        </div>
      </StudyShell>
    );
  }

  if (pairsAvailable < 3) {
    return (
      <StudyShell title="لعبة المطابقة" onBack={back}>
        <div className="study-empty">
          <h3>نحتاج بطاقات أولاً 🃏</h3>
          <p>ولّد بطاقات هذا الملف، ثم ارجع للعب ✨</p>
          <Link
            href={`/books/${bookId}/study?tool=cards`}
            className="primary-button"
          >
            توليد البطاقات
          </Link>
        </div>
      </StudyShell>
    );
  }

  return (
    <StudyShell
      title={`${formatSeconds(elapsed)} ثانية`}
      subtitle={data.book.fileName.replace(/\.pdf$/i, "")}
      onBack={back}
      actions={
        <button
          type="button"
          className="study-icon-button"
          onClick={() => setRound(r => r + 1)}
          aria-label="جولة جديدة"
        >
          <RotateCcw size={20} />
        </button>
      }
    >
      {finishedMs !== null ? (
        <div className="quiz-result">
          <Trophy size={40} />
          <h2>{formatSeconds(finishedMs)} ثانية 🎉</h2>
          <p>
            {best === finishedMs
              ? "رقم قياسي جديد! 🏆 أداء رائع 💪"
              : `أفضل وقت لك: ${formatSeconds(best ?? finishedMs)} ثانية — تقدر تكسره! 🔥`}
          </p>
          {penaltyMs > 0 && (
            <p>أخطاء: {penaltyMs / MISMATCH_PENALTY_MS} (+ثانية لكل خطأ)</p>
          )}
          <div className="quiz-result-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => setRound(r => r + 1)}
            >
              <RotateCcw size={16} /> العب مرة ثانية
            </button>
            <button type="button" className="secondary-button" onClick={back}>
              رجوع
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="match-hint">
            اضغط السؤال ثم جوابه ليختفيا — بأسرع وقت! ⚡
          </p>
          <div className="match-grid">
            {tiles.map(tile => {
              const state = matched.has(tile.id)
                ? "is-matched"
                : wrong.includes(tile.id)
                  ? "is-wrong"
                  : selected?.id === tile.id
                    ? "is-selected"
                    : "";
              return (
                <button
                  type="button"
                  key={`${round}-${tile.id}`}
                  className={`match-tile ${state}`}
                  dir="auto"
                  disabled={matched.has(tile.id)}
                  onClick={() => tap(tile)}
                >
                  {tile.text}
                </button>
              );
            })}
          </div>
          {best !== null && (
            <p className="match-best">
              🏆 أفضل وقت: {formatSeconds(best)} ثانية
            </p>
          )}
        </>
      )}
    </StudyShell>
  );
}
