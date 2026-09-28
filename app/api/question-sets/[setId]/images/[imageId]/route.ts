import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { extractedQuestionImages } from "@/drizzle/schema";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { doctorSetsEnabled } from "@/lib/doctor-sets-config";
import { getQuestionSetAccess } from "@/lib/question-set-access";
import { streamStoredObject } from "@/lib/storage-stream";

// 🔒 A protected question set's images (the question-file pipeline's page
// screenshots). Authorized per request with the one access rule (owner,
// entitled student inside the window, or admin), then streamed through the
// server: no signed storage URL and no storage key ever reach the browser,
// and nothing is cacheable, so revoking or disabling takes effect on the
// next request. Every refusal is the same 404.
const NOT_FOUND = () =>
  NextResponse.json(
    { error: "Not found" },
    { status: 404, headers: { "Cache-Control": "private, no-store" } }
  );

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ setId: string; imageId: string }> }
) {
  if (!doctorSetsEnabled()) return NOT_FOUND();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  const { setId, imageId } = await params;
  if (!UUID.test(setId) || !UUID.test(imageId)) return NOT_FOUND();

  const access = await getQuestionSetAccess(
    {
      id: session.user.id,
      role: (session.user as { role?: string }).role ?? null,
    },
    setId
  );
  if (!access) return NOT_FOUND();

  // The image must belong to THIS set's book — a valid set id can't be
  // paired with another book's image id.
  const db = getDb();
  if (!db) return NOT_FOUND();
  const [image] = await db
    .select({ storageKey: extractedQuestionImages.storageKey })
    .from(extractedQuestionImages)
    .where(
      and(
        eq(extractedQuestionImages.id, imageId),
        eq(extractedQuestionImages.bookId, access.bookId)
      )
    )
    .limit(1);
  if (!image) return NOT_FOUND();

  return streamStoredObject(image.storageKey, request, {
    cacheControl: "private, no-store",
  });
}
