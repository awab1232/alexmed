import { auth } from "@/lib/auth";
import { AiRateLimitError } from "@/lib/ai/types";
import { invokeLLM } from "@/lib/llm";
import {
  buildGenerateMessages,
  GENERATE_MAX_TOKENS,
  GeneratedCard,
  PageInput,
  parseJsonResponse,
  responseSchema,
} from "@/lib/pdf-cards";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

// Vercel Hobby's hard ceiling for a serverless function is 60s regardless of
// this value — set explicitly so the platform doesn't fall back to a lower
// default (10s) before our own AI-gateway timeout/retry budget can complete.
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    pages?: PageInput[];
    depth?: string;
  };
  const pages = Array.isArray(body.pages) ? body.pages : [];
  const usablePages = pages
    .filter(
      page =>
        Number.isInteger(page.page) &&
        typeof page.text === "string" &&
        page.text.trim()
    );

  if (!usablePages.length) {
    return NextResponse.json(
      { error: "لا توجد أسئلة نصية في هذه الدفعة." },
      { status: 400 }
    );
  }

  const depth =
    body.depth === "detailed"
      ? "detailed"
      : body.depth === "quick"
        ? "quick"
        : "balanced";

  try {
    // No model is passed here — the active provider (OmniRoute) owns model
    // selection entirely; see lib/ai/providers/omniroute.ts's resolveModel().
    const response = await invokeLLM({
      max_tokens: GENERATE_MAX_TOKENS,
      messages: buildGenerateMessages(usablePages, depth),
      response_format: responseSchema,
    });

    const parsed = parseJsonResponse(response.choices[0]?.message.content);
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards.map((card: GeneratedCard) => ({
          id: randomUUID(),
          ...card,
          sourcePage: usablePages.some(page => page.page === card.sourcePage)
            ? card.sourcePage
            : usablePages[0].page,
        }))
      : [];

    return NextResponse.json({
      cards,
      pages: usablePages.map(page => page.page),
    });
  } catch (error) {
    console.error("[PDF] Card generation failed", error);
    if (error instanceof AiRateLimitError) {
      return NextResponse.json(
        {
          error:
            "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي. سيُعاد المحاولة تلقائيًا بعد قليل.",
          retryAfterMs: error.retryAfterMs,
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error:
          "تعذر توليد البطاقات لهذه الدفعة. أعد المحاولة، وسيبقى تقدم الصفحات السابقة محفوظًا في الشاشة.",
      },
      { status: 502 }
    );
  }
}
