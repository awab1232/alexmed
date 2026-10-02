import type { LearnArticle } from "@/content/learn/articles";
import { learnPath } from "@/content/learn/articles";
import {
  SITE_ENTITY_IDS,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

const LT_ESCAPE = "\\" + "u003c";

export function LearnArticleJsonLd({ article }: { article: LearnArticle }) {
  const url = `${SITE_URL}${learnPath(article.slug)}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: article.title,
        name: article.title,
        description: article.description,
        inLanguage: article.language,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        author: { "@id": SITE_ENTITY_IDS.organization },
        publisher: { "@id": SITE_ENTITY_IDS.organization },
        mainEntityOfPage: { "@id": `${url}#page` },
        about: { "@id": SITE_ENTITY_IDS.software },
      },
      {
        "@type": "WebPage",
        "@id": `${url}#page`,
        url,
        name: article.title,
        description: article.description,
        inLanguage: article.language,
        isPartOf: { "@id": SITE_ENTITY_IDS.website },
        about: { "@id": SITE_ENTITY_IDS.software },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: SITE_NAME,
            item: `${SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Learn",
            item: `${SITE_URL}/learn`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: url,
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, LT_ESCAPE),
      }}
    />
  );
}
