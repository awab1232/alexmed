import Landing from "@/components/landing/Landing";
import StructuredData from "@/components/landing/StructuredData";
import { auth } from "@/lib/auth";
import { BASE_OPEN_GRAPH, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

// The public landing page. Signed-in students are served the app home
// (app/home) at this same URL by middleware.ts; the redirect below only
// catches a session the middleware's cookie check didn't see. Nothing here
// imports the app home, so this route ships none of its CSS or JS.
export default async function Page() {
  const session = await auth();
  if (session?.user) redirect("/subjects");

  return (
    <>
      <StructuredData />
      <Landing />
    </>
  );
}
