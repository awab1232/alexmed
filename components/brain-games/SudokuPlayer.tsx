"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eraser,
  Lightbulb,
  Loader2,
  PencilLine,
  RotateCcw,
  Undo2,
  WifiOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import {
  PEERS,
  boxOf,
  colOf,
  conflictingCells,
  rowOf,
} from "@/lib/brain-games/sudoku";
import type { StageResult } from "@/lib/db-brain-games";

type SavedBoard = {
  board: number[];
  notes: number[][];
  elapsedMs: number;
  mistakes: number;
};

type HistoryEntry = { index: number; value: number; notes: number[] };

const storageKey = (sessionId: string) => `bg-sudoku-${sessionId}`;

function loadLocal(sessionId: string): SavedBoard | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    return raw ? (JSON.parse(raw) as SavedBoard) : null;
  } catch {
    return null;
  }
}

function isSavedBoard(value: unknown): value is SavedBoard {
  const v = value as SavedBoard | null;
  return (
    !!v &&
    Array.isArray(v.board) &&
    v.board.length === 81 &&
    Array.isArray(v.notes) &&
    v.notes.length === 81
  );
}

const DIFFICULTY_AR: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
  expert: "خبير",
};

function formatClock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function SudokuPlayer({
  sessionId,
  stage,
  puzzle,
  difficulty,
  maxHints,
  initialHintsUsed,
  serverState,
  onFinished,
  onRestart,
}: {
  sessionId: string;
  stage: number;
  puzzle: number[];
  difficulty: string;
  maxHints: number;
  initialHintsUsed: number;
  serverState: Record<string, unknown> | null;
  onFinished: (result: StageResult) => void;
  onRestart: () => void;
}) {
  // Resume from this device's copy first (it's the newest), then the
  // server's autosave, else a fresh board.
  const start = useMemo<SavedBoard>(() => {
    const local = loadLocal(sessionId);
    if (isSavedBoard(local)) return local;
    if (isSavedBoard(serverState)) return serverState;
    return {
      board: [...puzzle],
      notes: Array.from({ length: 81 }, () => []),
      elapsedMs: 0,
      mistakes: 0,
    };
  }, [sessionId, serverState, puzzle]);

  const [board, setBoard] = useState<number[]>(start.board);
  const [notes, setNotes] = useState<number[][]>(start.notes);
  const [mistakes, setMistakes] = useState(start.mistakes);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(initialHintsUsed);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<
    "playing" | "submitting" | "network" | "expired"
  >("playing");

  // Active play time: accumulated + the running stretch while visible.
  const elapsedBase = useRef(start.elapsedMs);
  const runningSince = useRef<number | null>(null);
  const [, forceTick] = useState(0);
  const elapsed = () =>
    elapsedBase.current +
    (runningSince.current ? Date.now() - runningSince.current : 0);

  useEffect(() => {
    const resume = () => {
      if (runningSince.current === null) runningSince.current = Date.now();
    };
    const pause = () => {
      if (runningSince.current !== null) {
        elapsedBase.current += Date.now() - runningSince.current;
        runningSince.current = null;
      }
    };
    const onVisibility = () =>
      document.visibilityState === "hidden" ? pause() : resume();
    resume();
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(() => forceTick(t => t + 1), 1000);
    return () => {
      pause();
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
    };
  }, []);

  const conflicts = useMemo(() => conflictingCells(board), [board]);
  const given = (i: number) => puzzle[i] !== 0;

  // ── Autosave: this device immediately, the server shortly after ──
  const { mutate: saveToServer } = trpc.brainGames.sudokuSave.useMutation();
  const snapshot = useCallback(
    (): SavedBoard => ({ board, notes, elapsedMs: elapsed(), mistakes }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, notes, mistakes]
  );
  useEffect(() => {
    const state = snapshot();
    try {
      localStorage.setItem(storageKey(sessionId), JSON.stringify(state));
    } catch {
      // Storage unavailable — the server copy below still saves progress.
    }
    const timer = setTimeout(() => saveToServer({ sessionId, ...state }), 1500);
    return () => clearTimeout(timer);
  }, [snapshot, sessionId, saveToServer]);
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") {
        saveToServer({ sessionId, ...snapshot() });
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [snapshot, sessionId, saveToServer]);
  // The clock keeps running between moves: save it every few seconds and
  // when the page goes away, so a refresh never resets the solve time.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  useEffect(() => {
    const persistLocal = () => {
      try {
        localStorage.setItem(
          storageKey(sessionId),
          JSON.stringify(snapshotRef.current())
        );
      } catch {
        // Storage unavailable — the server autosave still has the board.
      }
    };
    const interval = setInterval(persistLocal, 3000);
    window.addEventListener("pagehide", persistLocal);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", persistLocal);
    };
  }, [sessionId]);

  // ── Moves ──
  const pushHistory = (index: number) =>
    setHistory(h => [
      ...h.slice(-199),
      { index, value: board[index], notes: notes[index] },
    ]);

  const place = (index: number, digit: number) => {
    if (given(index) || status !== "playing") return;
    if (notesMode && digit) {
      if (board[index]) return;
      pushHistory(index);
      setNotes(n => {
        const next = [...n];
        next[index] = n[index].includes(digit)
          ? n[index].filter(d => d !== digit)
          : [...n[index], digit].sort();
        return next;
      });
      return;
    }
    if (board[index] === digit) return;
    pushHistory(index);
    const nextBoard = [...board];
    nextBoard[index] = digit;
    setBoard(nextBoard);
    setNotes(n => {
      const next = [...n];
      next[index] = [];
      if (digit) {
        for (const p of PEERS[index]) {
          if (next[p].includes(digit)) {
            next[p] = next[p].filter(d => d !== digit);
          }
        }
      }
      return next;
    });
    if (digit && conflictingCells(nextBoard).has(index)) {
      setMistakes(m => m + 1);
    }
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last || status !== "playing") return;
    setHistory(h => h.slice(0, -1));
    setBoard(b => {
      const next = [...b];
      next[last.index] = last.value;
      return next;
    });
    setNotes(n => {
      const next = [...n];
      next[last.index] = last.notes;
      return next;
    });
    setSelected(last.index);
  };

  const hintMutation = trpc.brainGames.sudokuHint.useMutation();
  const takeHint = () => {
    if (hintsUsed >= maxHints || hintMutation.isPending) return;
    setMessage("");
    hintMutation.mutate(
      { sessionId, board },
      {
        onSuccess: hint => {
          setHintsUsed(hint.hintsUsed);
          setSelected(hint.index);
          pushHistory(hint.index);
          setBoard(b => {
            const next = [...b];
            next[hint.index] = hint.value;
            return next;
          });
          setNotes(n => {
            const next = [...n];
            next[hint.index] = [];
            return next;
          });
        },
        onError: error => setMessage(error.message),
      }
    );
  };

  // ── Completion: full board without conflicts → the server verifies ──
  const submitMutation = trpc.brainGames.submitSudoku.useMutation();
  const submitting = useRef(false);
  const submit = useCallback(() => {
    if (submitting.current) return;
    submitting.current = true;
    setStatus("submitting");
    submitMutation.mutate(
      { sessionId, board, elapsedMs: elapsed(), mistakes },
      {
        onSuccess: result => {
          try {
            localStorage.removeItem(storageKey(sessionId));
          } catch {
            // ignore
          }
          onFinished(result);
        },
        onError: error => {
          submitting.current = false;
          const code = error.data?.code;
          if (code === "PRECONDITION_FAILED" || code === "CONFLICT") {
            setStatus("expired");
          } else if (!code || code === "INTERNAL_SERVER_ERROR") {
            setStatus("network");
          } else {
            setStatus("playing");
          }
          setMessage(error.message);
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, mistakes, sessionId, onFinished]);

  const complete = board.every(v => v > 0) && conflicts.size === 0;
  useEffect(() => {
    if (complete && status === "playing") submit();
  }, [complete, status, submit]);

  useEffect(() => {
    if (status !== "network") return;
    window.addEventListener("online", submit);
    return () => window.removeEventListener("online", submit);
  }, [status, submit]);

  // ── Keyboard ──
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (status !== "playing") return;
      if (/^[1-9]$/.test(event.key) && selected !== null) {
        place(selected, Number(event.key));
      } else if (
        (event.key === "Backspace" || event.key === "Delete") &&
        selected !== null
      ) {
        place(selected, 0);
      } else if (event.key.toLowerCase() === "n") {
        setNotesMode(m => !m);
      } else if (
        event.key.toLowerCase() === "z" &&
        (event.ctrlKey || event.metaKey)
      ) {
        undo();
      } else if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const i = selected ?? 40;
        const r = rowOf(i);
        const c = colOf(i);
        const moves: Record<string, [number, number]> = {
          ArrowUp: [r - 1, c],
          ArrowDown: [r + 1, c],
          ArrowLeft: [r, c - 1],
          ArrowRight: [r, c + 1],
        };
        const target = moves[event.key];
        if (!target) return;
        const [nr, nc] = target;
        if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) setSelected(nr * 9 + nc);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const counts = useMemo(() => {
    const c = new Array<number>(10).fill(0);
    for (const v of board) if (v) c[v] += 1;
    return c;
  }, [board]);

  const sel = selected;
  const selectedValue = sel !== null ? board[sel] : 0;

  if (status === "expired") {
    return (
      <div className="bg-state" role="alert">
        <h2>انتهت هذه الجلسة</h2>
        <p>{message}</p>
        <button type="button" className="primary-button" onClick={onRestart}>
          <RotateCcw size={16} aria-hidden="true" /> ابدأ المستوى من جديد
        </button>
      </div>
    );
  }

  return (
    <div className="bg-sudoku">
      <div className="bg-sudoku-top">
        <span>
          المستوى {stage} ·{" "}
          <span className="bg-diff">
            {DIFFICULTY_AR[difficulty] ?? difficulty}
          </span>
        </span>
        <span role="timer" aria-label="الوقت">
          ⏱ {formatClock(elapsed())}
        </span>
        <span aria-label={`الأخطاء ${mistakes}`}>✗ {mistakes}</span>
      </div>

      <div
        className="bg-board"
        role="grid"
        aria-label="لوحة السودوكو"
        dir="ltr"
      >
        {board.map((value, i) => {
          const related =
            sel !== null &&
            i !== sel &&
            (rowOf(i) === rowOf(sel) ||
              colOf(i) === colOf(sel) ||
              boxOf(i) === boxOf(sel));
          const same = !!selectedValue && value === selectedValue && i !== sel;
          const classes = [
            "bg-cell",
            given(i) ? "is-given" : "",
            i === sel ? "is-selected" : "",
            related ? "is-related" : "",
            same ? "is-same" : "",
            conflicts.has(i) ? "is-conflict" : "",
            colOf(i) % 3 === 2 && colOf(i) !== 8 ? "edge-right" : "",
            rowOf(i) % 3 === 2 && rowOf(i) !== 8 ? "edge-bottom" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={classes}
              onClick={() => setSelected(i)}
              aria-selected={i === sel}
              aria-label={`صف ${rowOf(i) + 1} عمود ${colOf(i) + 1}: ${
                value ? value : "فارغة"
              }${given(i) ? " (ثابتة)" : ""}${
                conflicts.has(i) ? " — تعارض" : ""
              }`}
            >
              {value ? (
                <span className="bg-cell-value">{value}</span>
              ) : notes[i].length ? (
                <span className="bg-cell-notes" aria-hidden="true">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                    <span key={d}>{notes[i].includes(d) ? d : ""}</span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {message && (
        <p className="bg-sudoku-msg" role="status">
          {message}
        </p>
      )}
      {status === "network" && (
        <p className="bg-sudoku-msg" role="alert">
          <WifiOff size={14} aria-hidden="true" /> انقطع الاتصال — حلك محفوظ
          وسنرسله عند عودة الاتصال.{" "}
          <button type="button" onClick={submit}>
            إعادة المحاولة
          </button>
        </p>
      )}

      <div className="bg-actions">
        <button
          type="button"
          onClick={undo}
          disabled={!history.length || status !== "playing"}
        >
          <Undo2 size={20} aria-hidden="true" />
          <span>تراجع</span>
        </button>
        <button
          type="button"
          onClick={() => sel !== null && place(sel, 0)}
          disabled={sel === null || given(sel) || status !== "playing"}
        >
          <Eraser size={20} aria-hidden="true" />
          <span>مسح</span>
        </button>
        <button
          type="button"
          className={notesMode ? "is-on" : ""}
          aria-pressed={notesMode}
          onClick={() => setNotesMode(m => !m)}
        >
          <PencilLine size={20} aria-hidden="true" />
          <span>ملاحظات {notesMode ? "✓" : ""}</span>
        </button>
        <button
          type="button"
          onClick={takeHint}
          disabled={
            hintsUsed >= maxHints ||
            hintMutation.isPending ||
            status !== "playing"
          }
        >
          {hintMutation.isPending ? (
            <Loader2 size={20} className="spin" aria-hidden="true" />
          ) : (
            <Lightbulb size={20} aria-hidden="true" />
          )}
          <span>تلميح ({maxHints - hintsUsed})</span>
        </button>
      </div>

      <div className="bg-pad" dir="ltr" aria-label="الأرقام">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
          <button
            key={d}
            type="button"
            onClick={() => sel !== null && place(sel, d)}
            disabled={sel === null || given(sel) || status !== "playing"}
            aria-label={`${d}${notesMode ? " (ملاحظة)" : ""} — متبقٍ ${Math.max(0, 9 - counts[d])}`}
          >
            <strong>{d}</strong>
            <small>{Math.max(0, 9 - counts[d])}</small>
          </button>
        ))}
      </div>

      {status === "submitting" && (
        <div className="bg-state" aria-live="polite">
          <Loader2 size={24} className="spin" aria-hidden="true" />
          <p>نتحقق من الحل…</p>
        </div>
      )}
    </div>
  );
}
