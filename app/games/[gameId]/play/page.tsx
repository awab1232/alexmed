"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Loader2, Lock, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { BRAIN_GAMES, isBrainGameId } from "@/lib/brain-games/games";
import type { PublicSession, StageResult } from "@/lib/db-brain-games";
import QuizPlayer from "@/components/brain-games/QuizPlayer";
import SudokuPlayer from "@/components/brain-games/SudokuPlayer";
import StageResultView from "@/components/brain-games/StageResultView";

// Play one stage. Resumes the server's active session for this stage
// (refresh / reopen / other device) instead of starting over; otherwise
// asks the server to start it — which refuses locked stages.
export default function PlayStagePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const utils = trpc.useUtils();
  const valid = isBrainGameId(gameId);
  const requestedStage = Number(searchParams.get("stage")) || 1;

  const active = trpc.brainGames.activeSession.useQuery(
    { gameId: valid ? gameId : "math" },
    { enabled: valid, refetchOnWindowFocus: false, staleTime: Infinity }
  );
  const startStage = trpc.brainGames.startStage.useMutation();
  const [session, setSession] = useState<PublicSession | null>(null);
  const [result, setResult] = useState<StageResult | null>(null);
  const decided = useRef(false);

  const { mutate: startMutate } = startStage;
  const start = useCallback(
    (stage: number) => {
      if (!valid) return;
      setResult(null);
      setSession(null);
      startMutate(
        { gameId, stage },
        {
          onSuccess: fresh => {
            setSession(fresh);
            utils.brainGames.game.invalidate({ gameId });
          },
        }
      );
    },
    [valid, gameId, startMutate, utils]
  );

  useEffect(() => {
    if (!valid || decided.current || active.isLoading) return;
    decided.current = true;
    const existing = active.data;
    if (existing && existing.stage === requestedStage) setSession(existing);
    else start(requestedStage);
  }, [valid, active.isLoading, active.data, requestedStage, start]);

  const finished = useCallback(
    (stageResult: StageResult) => {
      setResult(stageResult);
      utils.brainGames.overview.invalidate();
      utils.brainGames.game.invalidate({ gameId: stageResult.gameId });
      utils.brainGames.activeSession.invalidate({
        gameId: stageResult.gameId,
      });
    },
    [utils]
  );

  if (!valid) {
    return (
      <section className="bg-page">
        <div className="bg-state">
          <h2>اللعبة غير موجودة</h2>
          <Link href="/games" className="primary-button">
            الألعاب
          </Link>
        </div>
      </section>
    );
  }

  const game = BRAIN_GAMES[gameId];
  const back = () => router.push(`/games/${gameId}`);
  const goTo = (stage: number) => {
    router.replace(`/games/${gameId}/play?stage=${stage}`);
    start(stage);
  };

  let body: React.ReactNode;
  if (result) {
    body = (
      <StageResultView
        result={result}
        kind={game.kind}
        totalStages={game.totalStages}
        onNext={() => result.nextStage && goTo(result.nextStage)}
        onRetry={() => goTo(result.stage)}
        onBack={() => router.push("/games")}
      />
    );
  } else if (startStage.error) {
    const locked = startStage.error.data?.code === "FORBIDDEN";
    body = (
      <div className="bg-state" role="alert">
        {locked && <Lock size={28} aria-hidden="true" />}
        <h2>{locked ? "هذا المستوى مقفل" : "تعذر بدء المستوى"}</h2>
        <p>{startStage.error.message}</p>
        {locked ? (
          <button type="button" className="primary-button" onClick={back}>
            العودة للمستويات
          </button>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={() => start(requestedStage)}
          >
            <RotateCcw size={16} aria-hidden="true" /> إعادة المحاولة
          </button>
        )}
      </div>
    );
  } else if (!session) {
    body = (
      <div className="bg-state" aria-live="polite">
        <Loader2 size={28} className="spin" aria-hidden="true" />
        <p>نجهّز المستوى {requestedStage}…</p>
      </div>
    );
  } else if (session.stageData.kind === "quiz") {
    body = (
      <QuizPlayer
        key={session.sessionId}
        sessionId={session.sessionId}
        stage={session.stage}
        questions={session.stageData.questions}
        passCorrect={session.stageData.passCorrect}
        autoAdvance={gameId !== "general_knowledge"}
        onFinished={finished}
        onRestart={() => goTo(session.stage)}
      />
    );
  } else {
    body = (
      <SudokuPlayer
        key={session.sessionId}
        sessionId={session.sessionId}
        stage={session.stage}
        puzzle={session.stageData.puzzle}
        difficulty={session.stageData.difficulty}
        maxHints={session.stageData.maxHints}
        initialHintsUsed={session.hintsUsed}
        serverState={session.clientState}
        onFinished={finished}
        onRestart={() => goTo(session.stage)}
      />
    );
  }

  return (
    <section className="bg-play">
      <header className="bg-play-header">
        <button
          type="button"
          className="bg-icon-btn"
          onClick={back}
          aria-label="رجوع للمستويات"
        >
          <ChevronRight size={22} />
        </button>
        <div>
          <strong>
            <span aria-hidden="true">{game.emoji}</span> {game.titleAr}
          </strong>
          <small>
            المستوى{" "}
            <bdi dir="ltr">
              {session?.stage ?? requestedStage}/{game.totalStages}
            </bdi>
          </small>
        </div>
      </header>
      {body}
    </section>
  );
}
