import { describe, expect, it } from "vitest";
import { INDEXABLE_LEARN_ARTICLES, LEARN_ARTICLES, learnPath } from "./articles";

const WRONG_PUBLIC_BRAND_SPELLINGS = [
  "NeroLearn",
  "Niro Learn",
  "Niro-Learn",
  "Nero Learn",
];

describe("Learn content registry", () => {
  it("keeps slugs, titles and descriptions unique", () => {
    expect(new Set(LEARN_ARTICLES.map(article => article.slug)).size).toBe(
      LEARN_ARTICLES.length
    );
    expect(new Set(LEARN_ARTICLES.map(article => article.title)).size).toBe(
      LEARN_ARTICLES.length
    );
    expect(new Set(LEARN_ARTICLES.map(article => article.description)).size).toBe(
      LEARN_ARTICLES.length
    );
  });

  it("publishes only substantial indexable articles", () => {
    expect(INDEXABLE_LEARN_ARTICLES.length).toBeGreaterThanOrEqual(7);
    for (const article of INDEXABLE_LEARN_ARTICLES) {
      expect(article.title).toBeTruthy();
      expect(article.description.length).toBeGreaterThan(50);
      expect(article.directAnswer.length).toBeGreaterThan(80);
      expect(article.sections.length).toBeGreaterThanOrEqual(3);
      expect(article.relatedArticles.length).toBeGreaterThanOrEqual(2);
      expect(article.relatedFeatures.length).toBeGreaterThanOrEqual(1);
      expect(learnPath(article.slug)).toBe(`/learn/${article.slug}`);
    }
  });

  it("links only to existing articles", () => {
    const slugs = new Set(LEARN_ARTICLES.map(article => article.slug));
    for (const article of LEARN_ARTICLES) {
      for (const related of article.relatedArticles) {
        expect(slugs.has(related), `${article.slug} links to ${related}`).toBe(true);
      }
    }
  });

  it("does not publish uncontrolled brand spelling variants", () => {
    const publicText = JSON.stringify(LEARN_ARTICLES);
    for (const spelling of WRONG_PUBLIC_BRAND_SPELLINGS) {
      expect(publicText).not.toContain(spelling);
    }
  });
});
