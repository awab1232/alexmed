import Link from "next/link";
import { LEARN_TOPIC_BY_ID } from "@/content/learn/topics";
import type { LearnArticle } from "@/content/learn/articles";
import { getLearnArticle, learnPath } from "@/content/learn/articles";
import { MarketingPage } from "@/components/landing/SiteChrome";
import s from "@/components/landing/landing.module.css";
import ls from "./learn.module.css";

export function LearnIndex({ articles }: { articles: LearnArticle[] }) {
  return (
    <MarketingPage current="/learn">
      <section className={s.hero} aria-labelledby="learn-title">
        <div className={s.heroCopy}>
          <p className={s.kicker}>NiroLearn Knowledge Hub</p>
          <h1 id="learn-title" className={s.heroTitle}>
            مركز معرفة NiroLearn للدراسة بالذكاء الاصطناعي
          </h1>
          <p className={s.heroLede}>
            مقالات مرجعية تساعد الطلاب على فهم أدوات الدراسة، تلخيص PDF، الفلاش
            كارد، التحضير للامتحان، والألعاب التعليمية — بدون حشو كلمات أو وعود
            غير مضمونة.
          </p>
        </div>
        <div className={ls.factCard}>
          <strong>NiroLearn at a glance</strong>
          <dl>
            <div>
              <dt>Type</dt>
              <dd>AI-powered learning platform</dd>
            </div>
            <div>
              <dt>Audience</dt>
              <dd>Students and learners</dd>
            </div>
            <div>
              <dt>Core tools</dt>
              <dd>Summaries, flashcards, questions, quizzes, mind maps, Exam Focus.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className={s.section} aria-labelledby="articles-title">
        <div className={s.sectionHead}>
          <h2 id="articles-title">الأدلة الأساسية</h2>
          <p>صفحات قليلة لكنها مفيدة، وكل صفحة تربط المفهوم بأداة NiroLearn المناسبة.</p>
        </div>
        <div className={ls.articleGrid}>
          {articles.map(article => {
            const topic = LEARN_TOPIC_BY_ID.get(article.category);
            return (
              <article key={article.slug} className={ls.articleCard}>
                {topic ? <span className={ls.topic}>{topic.title}</span> : null}
                <h3>
                  <Link href={learnPath(article.slug)}>{article.title}</Link>
                </h3>
                <p>{article.description}</p>
              </article>
            );
          })}
        </div>
      </section>
    </MarketingPage>
  );
}

export function LearnArticlePage({ article }: { article: LearnArticle }) {
  const topic = LEARN_TOPIC_BY_ID.get(article.category);
  const dir = article.language === "ar" ? "rtl" : "ltr";

  return (
    <MarketingPage current="/learn">
      <article className={ls.articlePage} dir={dir}>
        <nav className={ls.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">NiroLearn</Link>
          <span aria-hidden="true">/</span>
          <Link href="/learn">Learn</Link>
          <span aria-hidden="true">/</span>
          <span>{article.title}</span>
        </nav>

        <header className={ls.articleHeader}>
          {topic ? <p className={s.kicker}>{topic.title}</p> : null}
          <h1>{article.title}</h1>
          <p>{article.directAnswer}</p>
          <small>
            Last updated: <time dateTime={article.updatedAt}>{article.updatedAt}</time>
          </small>
        </header>

        {article.factBlock ? <FactBlock facts={article.factBlock} /> : null}

        <div className={ls.bodyGrid}>
          <aside className={ls.toc} aria-label="محتويات المقال">
            <strong>في هذا الدليل</strong>
            {article.sections.map(section => (
              <a key={section.id} href={`#${section.id}`}>
                {section.title}
              </a>
            ))}
          </aside>

          <div className={ls.articleBody}>
            {article.sections.map(section => (
              <section key={section.id} id={section.id}>
                <h2>{section.title}</h2>
                {section.body.map(paragraph => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul>
                    {section.bullets.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>

        <footer className={ls.articleFooter}>
          <div>
            <h2>مواضيع مرتبطة</h2>
            <ul className={ls.linkList}>
              {article.relatedArticles.map(slug => {
                const related = getLearnArticle(slug);
                if (!related) return null;
                return (
                  <li key={slug}>
                    <Link href={learnPath(slug)}>{related.title}</Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h2>أدوات NiroLearn ذات صلة</h2>
            <ul className={ls.linkList}>
              {article.relatedFeatures.map(feature => (
                <li key={feature.href}>
                  <Link href={feature.href}>{feature.label}</Link>
                  <p>{feature.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      </article>
    </MarketingPage>
  );
}

function FactBlock({ facts }: { facts: NonNullable<LearnArticle["factBlock"]> }) {
  return (
    <section className={ls.factBlock} aria-labelledby="fact-block-title">
      <h2 id="fact-block-title">NiroLearn at a glance</h2>
      <dl>
        {Object.entries(facts).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{Array.isArray(value) ? value.join("، ") : value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
