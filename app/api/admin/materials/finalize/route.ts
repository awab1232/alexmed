import { finalizeAdminMaterialIfDone } from "@/lib/db-admin-materials";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// Defensive backstop, same role as app/api/mirror/finalize/route.ts — the
// generate-batch worker also calls finalizeAdminMaterialIfDone directly
// after each batch, so this route mostly exists in case that inline call
// somehow didn't fire.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody) as { materialId?: string };
    const materialId =
      typeof body.materialId === "string" ? body.materialId : "";
    if (!materialId) {
      return NextResponse.json(
        { error: "معرف المادة مفقود." },
        { status: 200 }
      );
    }

    await finalizeAdminMaterialIfDone(materialId);
    return NextResponse.json({ materialId, status: "checked" });
  } catch (error) {
    console.error("[AdminMaterials] Finalize failed", error);
    return NextResponse.json(
      { error: "تعذر التحقق من هذه المادة." },
      { status: 502 }
    );
  }
}
