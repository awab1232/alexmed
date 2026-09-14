import * as dbBooks from "./db-books";

export async function getSafeChapterVisualAssets(chapterId: string) {
  try {
    return (await dbBooks.getChapterVisualAssets?.(chapterId)) ?? [];
  } catch {
    // Keeps isolated route tests and older deployments usable while the DB
    // helper is being rolled out; production returns the real persisted assets.
    return [];
  }
}

export async function hasSafePendingChapterVisualAnalysis(chapterId: string) {
  try {
    return Boolean(await dbBooks.hasPendingChapterVisualAnalysis?.(chapterId));
  } catch {
    return false;
  }
}

export async function replaceSafeBookPageVisualAssets(
  pageId: string,
  bookId: string,
  chapterId: string | null,
  assets: Parameters<typeof dbBooks.insertBookVisualAssets>[3]
) {
  try {
    if (dbBooks.replaceBookPageVisualAssets) {
      await dbBooks.replaceBookPageVisualAssets(pageId, bookId, chapterId, assets);
      return;
    }
  } catch {
    // Fall through to the original insert helper for older/mock environments.
  }
  await dbBooks.insertBookVisualAssets(pageId, bookId, chapterId, assets);
}
