import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BASE_OPEN_GRAPH } from "@/lib/site";
import {
  getLearnArticle,
  INDEXABLE_LEARN_ARTICLES,
  learnPath,
} from "@/content/learn/articles";
import { LearnArticleJsonLd } from "@/components/learn/LearnJsonLd";
import { LearnArticlePage } from "@/components/learn/LearnPage";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return INDEXABLE_LEARN_ARTICLES.map(article => ({ slug: article.slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const article = getLearnArticle(params.slug);
  if (!article || !article.indexable) return {};
  const path = learnPath(article.slug);
  return {
    title: `${article.title} | NiroLearn`,
    description: article.description,
    alternates: { canonical: path },
    openGraph: {
      ...BASE_OPEN_GRAPH,
      url: path,
      title: `${article.title} | NiroLearn`,
      description: article.description,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
    },
  };
}

export default function LearnArticleRoute({ params }: { params: Params }) {
  const article = getLearnArticle(params.slug);
  if (!article || !article.indexable) notFound();

  return (
    <>
      <LearnArticleJsonLd article={article} />
      <LearnArticlePage article={article} />
    </>
  );
}
