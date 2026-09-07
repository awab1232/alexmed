import { describe, expect, it } from "vitest";
import { linkSourcePagesToVisualAssets } from "./db-books";

describe("linkSourcePagesToVisualAssets", () => {
  it("links a card's sourcePage to the visual assets on the matching page", () => {
    const pages = [
      { id: "page-1", pageNumber: 1 },
      { id: "page-2", pageNumber: 2 },
    ];
    const visuals = [
      { id: "asset-1", pageId: "page-2" },
      { id: "asset-2", pageId: "page-2" },
    ];

    const linkFor = linkSourcePagesToVisualAssets(pages, visuals);

    // Page 1 has no visuals yet (or none at all) -> empty, not an error.
    expect(linkFor(1)).toEqual({ pageId: "page-1", relatedAssetIds: [] });

    // Page 2 has two visual assets -> both linked, in insertion order.
    expect(linkFor(2)).toEqual({
      pageId: "page-2",
      relatedAssetIds: ["asset-1", "asset-2"],
    });
  });

  it("returns null pageId/empty relatedAssetIds for a sourcePage with no matching page", () => {
    const linkFor = linkSourcePagesToVisualAssets([], []);
    expect(linkFor(5)).toEqual({ pageId: null, relatedAssetIds: [] });
  });
});
