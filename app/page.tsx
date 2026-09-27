import Home from "@/components/Home";
import Landing from "@/components/landing/Landing";
import StructuredData from "@/components/landing/StructuredData";
import { auth } from "@/lib/auth";
import { BASE_OPEN_GRAPH, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";
import type { Metadata } from "next";

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

// Signed-in students get the app home exactly as before; everyone else gets
// the public landing page (which links to /register and /login).
export default async function Page() {
  const session = await auth();
  if (session?.user) return <Home />;

  return (
    <>
      <StructuredData />
      <Landing />
    </>
  );
}
