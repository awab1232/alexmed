// A book is stored under its uploaded file name; students should see a
// title, not a file: drop the extension and turn separators into spaces.
export function bookDisplayTitle(fileName: string | null | undefined): string {
  const name = (fileName ?? "").trim();
  if (!name) return "كتاب بدون عنوان";
  const withoutExt = name.replace(/\.pdf$/i, "");
  const spaced = withoutExt.replace(/[_]+/g, " ").replace(/\s{2,}/g, " ");
  return spaced.trim() || name;
}
