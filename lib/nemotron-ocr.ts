// NVIDIA's nemotron-ocr-v1: a dedicated text-detection CV model, called
// directly against NVIDIA's own API — NOT through OmniRoute/invokeLLM. Two
// real, live-tested reasons it can't be just another OMNIROUTE_FALLBACK_MODELS
// entry: (1) it isn't in OmniRoute's live catalog for the nvidia provider at
// all (confirmed via direct curl — every provider/model-shaped guess came
// back "not available in the active live catalog"), and (2) even if it were,
// its request/response shape isn't OpenAI chat/completions-compatible — it's
// `{ input: [{ type: "image_url", url }] }` in, a bounding-box text-detection
// list out, not a chat message.
//
// Why bother with a second OCR path at all: a real production incident
// (2026-09-19, مِرآة job 89f092f8) had every page of a genuinely scanned PDF
// come back hasText:false with NO thrown error — the chat-vision fallback
// chain silently landed on a model that answered confidently instead of
// failing when it couldn't really read the page. A purpose-built text-
// detection model has no such failure mode (it either finds detections or
// returns an empty list from a real bounding-box search) and is used FIRST
// in lib/pdf-ocr.ts's ocrPages, with the existing chat-vision model kept as
// the fallback for when this isn't configured or errors out.
const NEMOTRON_OCR_URL =
  "https://ai.api.nvidia.com/v1/cv/nvidia/nemotron-ocr-v1";
const REQUEST_TIMEOUT_MS = 30_000;

type TextDetection = {
  text_prediction?: { text?: string; confidence?: number };
  bounding_box?: { points?: { x: number; y: number }[] };
};

type NemotronOcrResponse = {
  data?: { index: number; text_detections?: TextDetection[] }[];
};

export function isNemotronOcrConfigured(): boolean {
  return !!process.env.NVIDIA_OCR_API_KEY;
}

// Detections arrive unordered — reconstruct rough reading order from each
// box's top-left corner: group into lines by rounding the top y-coordinate
// (normalized 0-1, so 2% of page height) and sort left-to-right within a
// line. Best-effort, not real layout analysis — good enough for feeding a
// flashcard/summary generator, which only needs the words, not a perfect
// transcription.
const LINE_BUCKET = 0.02;
export function buildTextFromDetections(detections: TextDetection[]): string {
  const rows = detections
    .map(d => {
      const points = d.bounding_box?.points ?? [];
      const text = d.text_prediction?.text?.trim() ?? "";
      if (!text || !points.length) return null;
      const top = Math.min(...points.map(p => p.y));
      const left = Math.min(...points.map(p => p.x));
      return { text, top, left };
    })
    .filter((r): r is { text: string; top: number; left: number } => !!r)
    .sort((a, b) => {
      const lineA = Math.round(a.top / LINE_BUCKET);
      const lineB = Math.round(b.top / LINE_BUCKET);
      return lineA !== lineB ? lineA - lineB : a.left - b.left;
    });

  const lines: string[] = [];
  let currentLine = Number.NaN;
  let buffer: string[] = [];
  for (const row of rows) {
    const line = Math.round(row.top / LINE_BUCKET);
    if (line !== currentLine) {
      if (buffer.length) lines.push(buffer.join(" "));
      buffer = [];
      currentLine = line;
    }
    buffer.push(row.text);
  }
  if (buffer.length) lines.push(buffer.join(" "));
  return lines.join("\n");
}

export async function nemotronOcrPage(
  imageDataUrl: string
): Promise<{ text: string; hasText: boolean }> {
  const apiKey = process.env.NVIDIA_OCR_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_OCR_API_KEY is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(NEMOTRON_OCR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: [{ type: "image_url", url: imageDataUrl }],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `nemotron-ocr-v1 request failed: ${response.status} ${await response.text().catch(() => "")}`
    );
  }

  const json = (await response.json()) as NemotronOcrResponse;
  const detections = json.data?.[0]?.text_detections ?? [];
  const text = buildTextFromDetections(detections);
  return { text, hasText: text.length > 0 };
}
