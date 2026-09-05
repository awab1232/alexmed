import { redirect } from "next/navigation";

// Superseded by /review (unified مِرآة + كتبي daily review queue, Item C of
// the reliability plan) — kept as a redirect so old links/bookmarks to this
// path still land somewhere useful.
export default function BooksReviewRedirect() {
  redirect("/review");
}
