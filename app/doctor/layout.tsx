import "@/app/globals.css";
import BottomNav from "@/components/BottomNav";
import { auth } from "@/lib/auth";
import { isApprovedDoctor } from "@/lib/db-doctors";
import { doctorSetsEnabled } from "@/lib/doctor-sets-config";
import { notFound, redirect } from "next/navigation";

// Server-side gate for /doctor/* — same app shell as the rest of the
// student app (no separate product, no separate login). Approval is read
// from the database on every request, like doctorProcedure; this layout is
// defense in depth, every query/mutation behind it checks again.
export const dynamic = "force-dynamic";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!doctorSetsEnabled()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!(await isApprovedDoctor(session.user.id))) redirect("/account/doctor");

  return (
    <div className="app-shell">
      <main className="main-content">{children}</main>
      <BottomNav />
    </div>
  );
}
