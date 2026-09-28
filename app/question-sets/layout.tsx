import "@/app/globals.css";
import BottomNav from "@/components/BottomNav";
import { auth } from "@/lib/auth";
import { doctorSetsEnabled } from "@/lib/doctor-sets-config";
import { notFound, redirect } from "next/navigation";

// The student's "مجموعات الدكاترة": same shell and login as ملفات الأسئلة.
// Every read behind these pages is authorized per request on the server
// (lib/question-set-access.ts); this layout only keeps signed-out visitors
// and a disabled feature out.
export const dynamic = "force-dynamic";

export default async function QuestionSetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!doctorSetsEnabled()) notFound();
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/question-sets");

  return (
    <div className="app-shell">
      <main className="main-content">{children}</main>
      <BottomNav />
    </div>
  );
}
