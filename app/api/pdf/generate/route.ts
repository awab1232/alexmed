import { auth } from "@/lib/auth";
import { invokeLLM } from "@/lib/llm";
import {
  buildGenerateMessages,
  GENERATE_MAX_TOKENS,
  GeneratedCard,
  PageInput,
  parseJsonResponse,
  responseSchema,
} from "@/lib/pdf-cards";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  const allowed = await checkRateLimit(
    `pdf:${getClientIp(request)}`,
    30,
    60 * 60
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "تجاوزت الحد المسموح من الطلبات. حاول لاحقًا." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    pages?: PageInput[];
    depth?: string;
    model?: string;
  };
  const pages = Array.isArray(body.pages) ? body.pages : [];
  const usablePages = pages
    .filter(
      page =>
        Number.isInteger(page.page) &&
        typeof page.text === "string" &&
        page.text.trim()
    )
    .slice(0, 4);

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
    const response = await invokeLLM({
      model: typeof body.model === "string" ? body.model : undefined,
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
    return NextResponse.json(
      {
        error:
          "تعذر توليد البطاقات لهذه الدفعة. أعد المحاولة، وسيبقى تقدم الصفحات السابقة محفوظًا في الشاشة.",
      },
      { status: 502 }
    );
  }
}
