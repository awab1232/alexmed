import Landing from "@/components/landing/Landing";
import StructuredData from "@/components/landing/StructuredData";
import { auth } from "@/lib/auth";
import { BASE_OPEN_GRAPH, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";
import type { Metadata } from "next";
import dynamic from "next/dynamic";

// Loaded only for signed-in students, so visitors on the landing page
// don't download the app home's client code.
const Home = dynamic(() => import("@/components/Home"));

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
