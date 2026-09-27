// Public landing page for signed-out visitors at "/". Server component
// only: no client JavaScript of its own (FAQ uses <details>). Copy
// describes features that exist today; every preview is labelled as example
// content. Sign-up and sign-in go to the existing /register and /login.
import Link from "next/link";
import NiroCharacter from "@/components/niro/NiroCharacter";
import NiroSpark from "@/components/niro/NiroSpark";
import { SITE_NAME } from "@/lib/site";
import s from "./landing.module.css";

// A negative number kept left-to-right inside Arabic text.
const MINUS_70 = <bdi dir="ltr">−70</bdi>;

export const LANDING_FAQ = [
  {
    q: "هل NiroLearn مجاني؟",
    a: "نعم، يمكنك البدء بالخطة المجانية دون بطاقة دفع. وتتوفر خطتا Pro وUltimate لحدود استخدام أعلى، وتفاصيلهما في صفحة الأسعار.",
  },
  {
    q: "ما الملفات التي يمكنني رفعها؟",
    a: "ملفات PDF: كتب، ومحاضرات، وملفات أسئلة. ويقرأ NiroLearn النص حتى من الصفحات المصوّرة.",
  },
  {
    q: "هل يدعم المواد المكتوبة بالإنجليزية؟",
    a: "نعم. الواجهة بالعربية، ويمكنك رفع مواد بالعربية أو بالإنجليزية، مثل مواد الطب والهندسة.",
  },
  {
    q: "هل ملفاتي خاصة؟",
    a: "ملفاتك مرتبطة بحسابك، ولا يراها غيرك إلا إذا شاركتها بنفسك مع زميل. التفاصيل في سياسة الخصوصية.",
  },
  {
    q: "كيف أنشئ حسابًا؟",
    a: "برقم هاتفك ورمز تحقق يصلك برسالة نصية، ثم تبدأ برفع أول ملف.",
  },
] as const;

const PROBLEMS = [
  {
    problem: "ملف من مئات الصفحات، ولا تعرف من أين تبدأ",
    answer:
      "يقرأ NiroLearn الملف كاملًا ويقسّمه إلى أجزاء واضحة تذاكرها بالترتيب.",
  },
  {
    problem: "وقت دراسة طويل يضيع في إعادة القراءة",
    answer: "ملخص منظم لكل جزء، بعناوين ونقاط، بدل قراءة كل شيء من جديد.",
  },
  {
    problem: "صعوبة معرفة المهم للامتحان",
    answer:
      "Exam Focus يجمع المعلومات عالية الأهمية من كامل المادة في بطاقات قصيرة.",
  },
  {
    problem: "نسيان ما ذاكرته بعد أيام",
    answer: "بطاقات مراجعة بجدولة تكرار متباعد تعيد لك كل معلومة في وقتها.",
  },
] as const;

const STEPS = [
  {
    title: "ارفع ملفك",
    text: "كتاب، أو محاضرة، أو ملف أسئلة بصيغة PDF، بالعربية أو بالإنجليزية.",
  },
  {
    title: "Niro يحلّله",
    text: "يقرأ كل الصفحات، حتى المصوّرة منها، ويبني أدوات المذاكرة من محتواها.",
  },
  {
    title: "ذاكر بذكاء",
    text: "ملخص، وExam Focus، وبطاقات، واختبارات، وخريطة ذهنية، كلها من ملفك.",
  },
] as const;

const FOCUS_CARDS = [
  {
    tag: "لازم تعرفها",
    text: "المحور العصبي ينقل الإشارة بعيدًا عن جسم الخلية.",
  },
  {
    tag: "أرقام وحدود",
    text: <>جهد الراحة للخلية العصبية نحو {MINUS_70} ملي فولت.</>,
  },
  {
    tag: "فخ امتحان",
    text: "مضخة الصوديوم والبوتاسيوم تُخرج 3 صوديوم وتُدخل 2 بوتاسيوم، لا العكس.",
  },
] as const;

export default function Landing() {
  return (
    <div className={s.page}>
      <a className={s.skip} href="#main">
        انتقل إلى المحتوى
      </a>

      <header className={s.header}>
        <div className={s.bar}>
          <Link
            href="/"
            className={s.brand}
            aria-label={`${SITE_NAME}، الصفحة الرئيسية`}
          >
            <NiroSpark size={22} />
            <span>{SITE_NAME}</span>
          </Link>
          <nav aria-label="أقسام الصفحة" className={s.nav}>
            <a href="#features">الميزات</a>
            <a href="#how">كيف يعمل</a>
            <a href="#exam-focus">Exam Focus</a>
            <Link href="/pricing">الأسعار</Link>
          </nav>
          <div className={s.headerActions}>
            <Link href="/login" className={s.linkButton}>
              تسجيل الدخول
            </Link>
            <Link href="/register" className={s.primarySmall}>
              ابدأ مجانًا
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className={s.hero} aria-labelledby="hero-title">
          <div className={s.heroCopy}>
            <h1 id="hero-title" className={s.heroTitle}>
              حوّل كتبك ومحاضراتك إلى مذاكرة جاهزة للامتحان
            </h1>
            <p className={s.heroLede}>
              ارفع ملف PDF، وNiroLearn يقرأه كاملًا ويحوّله إلى ملخص منظم، وExam
              Focus لأهم المعلومات، وبطاقات مراجعة، واختبارات، وخريطة ذهنية، مع
              Niro مساعدك الذكي في الدراسة.
            </p>
            <div className={s.ctaRow}>
              <Link href="/register" className={s.primary}>
                ابدأ مجانًا
              </Link>
              <Link href="/login" className={s.secondary}>
                تسجيل الدخول
              </Link>
            </div>
            <p className={s.fineprint}>حساب مجاني برقم هاتفك، دون بطاقة دفع.</p>
          </div>

          <HeroSheet />
        </section>

        {/* ── Problem → solution ───────────────────────────────────── */}
        <section className={s.section} aria-labelledby="problem-title">
          <div className={s.sectionHead}>
            <h2 id="problem-title">المذاكرة صعبة لأسباب نعرفها</h2>
            <p>والحل ليس أن تذاكر أكثر، بل أن تعرف ماذا تذاكر وكيف تثبّته.</p>
          </div>
          <ol className={s.ledger}>
            {PROBLEMS.map(item => (
              <li key={item.problem} className={s.ledgerRow}>
                <p className={s.ledgerProblem}>
                  <span className={s.strike}>{item.problem}</span>
                </p>
                <p className={s.ledgerAnswer}>{item.answer}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── How it works ─────────────────────────────────────────── */}
        <section id="how" className={s.section} aria-labelledby="how-title">
          <div className={s.sectionHead}>
            <h2 id="how-title">كيف يعمل NiroLearn؟</h2>
            <p>ثلاث خطوات من الملف إلى المذاكرة.</p>
          </div>
          <ol className={s.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title} className={s.step}>
                <span className={s.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Exam Focus ───────────────────────────────────────────── */}
        <section
          id="exam-focus"
          className={s.focusBand}
          aria-labelledby="focus-title"
        >
          <div className={s.focusInner}>
            <div className={s.focusCopy}>
              <h2 id="focus-title">
                Exam Focus: أهم ما في المادة، من الملف كاملًا
              </h2>
              <p>
                بدل أن تقرأ كل الصفحات بالأهمية نفسها، يمرّ Exam Focus على كامل
                الملف ويستخرج المعلومات عالية الأهمية في بطاقات قصيرة، مصنّفة
                حسب نوعها: لازم تعرفها، ومهمة جدًا، وفخ امتحان، وأرقام وحدود،
                ومقارنة، وغيرها.
              </p>
              <ul className={s.focusPoints}>
                <li>كل بطاقة تذكر الصفحات التي جاءت منها لترجع إليها.</li>
                <li>احفظ البطاقات التي تحتاج مراجعتها قبل الامتحان.</li>
                <li>أداة للتركيز لا بديل عن مادتك: راجع دائمًا مع المصدر.</li>
              </ul>
            </div>
            <figure className={s.focusStack}>
              {FOCUS_CARDS.map(card => (
                <div key={card.tag} className={s.focusCard}>
                  <span className={s.focusTag}>{card.tag}</span>
                  <p>{card.text}</p>
                  <span className={s.focusSource}>صفحة 12</span>
                </div>
              ))}
              <figcaption className={s.caption}>
                مثال توضيحي بمحتوى تجريبي.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ── Features + product preview ───────────────────────────── */}
        <section
          id="features"
          className={s.section}
          aria-labelledby="features-title"
        >
          <div className={s.sectionHead}>
            <h2 id="features-title">كل أدوات المذاكرة في مكان واحد</h2>
            <p>كل أداة تُبنى من ملفك أنت، فتذاكر المحتوى الذي ستُمتحن فيه.</p>
          </div>

          <div className={s.features}>
            <Feature
              title="ملخص منظم"
              text="ملخص شامل لكل جزء من الملف، مرتّب بعناوين ونقاط تقرأه في دقائق."
              preview={<SummaryPreview />}
            />
            <Feature
              title="بطاقات مراجعة"
              text="بطاقات سؤال وجواب من محتوى ملفك، مع جدولة مراجعة تتكيّف مع أدائك."
              preview={<FlashcardPreview />}
            />
            <Feature
              title="اختبارات من ملفك"
              text="أسئلة اختيار من متعدد مبنية على محتوى الملف، مع شرح لكل إجابة."
              preview={<QuizPreview />}
            />
            <Feature
              title="خريطة ذهنية"
              text="تنظيم المعلومات بصريًا لترى كيف ترتبط الأفكار ببعضها."
              preview={<MindMapPreview />}
            />
            <Feature
              title="Niro، مساعدك في الدراسة"
              text="حدّد فقرة أو اكتب سؤالك، ويشرح لك Niro بالاعتماد على صفحات ملفك."
              preview={<AssistantPreview />}
            />
          </div>

          <div className={s.alsoRow}>
            <h3>وأيضًا</h3>
            <ul>
              <li>قارئ PDF مع تظليل وملاحظات على الصفحات.</li>
              <li>حوّل ملفات الأسئلة السابقة إلى بطاقات مراجعة.</li>
              <li>شارك حزمة مذاكرة مع زملائك.</li>
              <li>ألعاب مراجعة سريعة مع Niro.</li>
            </ul>
          </div>
          <p className={s.caption}>
            المعاينات أمثلة توضيحية بمحتوى تجريبي من واجهة NiroLearn.
          </p>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────── */}
        <section className={s.section} aria-labelledby="faq-title">
          <div className={s.sectionHead}>
            <h2 id="faq-title">أسئلة شائعة</h2>
          </div>
          <div className={s.faq}>
            {LANDING_FAQ.map(item => (
              <details key={item.q} className={s.faqItem}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────────── */}
        <section className={s.cta} aria-labelledby="cta-title">
          <NiroCharacter
            expression="victory"
            size={132}
            animated={false}
            className={s.ctaNiro}
          />
          <div>
            <h2 id="cta-title">جاهز تبدأ دراسة أذكى؟</h2>
            <p>ارفع أول ملف لك مجانًا، وشاهد كيف يتحوّل إلى مذاكرة منظمة.</p>
            <Link href="/register" className={s.primary}>
              ابدأ مجانًا
            </Link>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.footerInner}>
          <div className={s.footerBrand}>
            <span className={s.brand}>
              <NiroSpark size={20} />
              <span>{SITE_NAME}</span>
            </span>
            <p>منصة دراسة بالذكاء الاصطناعي تحوّل ملفاتك إلى مذاكرة منظمة.</p>
          </div>
          <nav aria-label="روابط الموقع" className={s.footerNav}>
            <Link href="/">الرئيسية</Link>
            <a href="#features">الميزات</a>
            <a href="#how">كيف يعمل</a>
            <Link href="/pricing">الأسعار</Link>
            <Link href="/login">تسجيل الدخول</Link>
            <Link href="/register">إنشاء حساب</Link>
            <Link href="/privacy">سياسة الخصوصية</Link>
            <Link href="/terms">سياسة الاستخدام</Link>
            <Link href="/contact">تواصل معنا</Link>
          </nav>
        </div>
        <p className={s.copyright}>
          © {new Date().getFullYear()} {SITE_NAME}
        </p>
      </footer>
    </div>
  );
}

function Feature({
  title,
  text,
  preview,
}: {
  title: string;
  text: string;
  preview: React.ReactNode;
}) {
  return (
    <article className={s.feature}>
      <div className={s.featureCopy}>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <div className={s.preview} aria-hidden="true">
        {preview}
      </div>
    </article>
  );
}

// The signature moment: a lecture page with the exam-relevant lines marked,
// and what NiroLearn makes from it. Decorative; the heading carries meaning.
function HeroSheet() {
  return (
    <div className={s.heroVisual} aria-hidden="true">
      <div className={s.sheet}>
        <div className={s.sheetHead}>
          <span>محاضرة 3 · الخلية العصبية</span>
          <span>صفحة 12</span>
        </div>
        <p className={s.sheetText}>
          تنقل الخلايا العصبية الإشارات الكهربائية على طول{" "}
          <mark className={s.mark}>المحور العصبي بعيدًا عن جسم الخلية</mark>.
          ويبلغ{" "}
          <mark className={`${s.mark} ${s.markDelay1}`}>
            جهد الراحة للغشاء نحو {MINUS_70} ملي فولت
          </mark>
          ، وتحافظ عليه{" "}
          <mark className={`${s.mark} ${s.markDelay2}`}>
            مضخة الصوديوم والبوتاسيوم
          </mark>{" "}
          التي تنقل الأيونات عكس تدرّج تركيزها، مستهلكةً الطاقة في كل دورة.
        </p>
        <div className={s.sheetLines}>
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className={s.outputs}>
        <div className={s.outCard}>
          <span className={s.focusTag}>Exam Focus · أرقام وحدود</span>
          <p>جهد الراحة ≈ {MINUS_70} ملي فولت</p>
        </div>
        <div className={s.outChips}>
          <span>ملخص</span>
          <span>بطاقات</span>
          <span>اختبار</span>
          <span>خريطة ذهنية</span>
        </div>
      </div>

      <NiroCharacter
        expression="explaining"
        size={150}
        animated={false}
        className={s.heroNiro}
      />
    </div>
  );
}

function SummaryPreview() {
  return (
    <div className={s.pvSummary}>
      <p className={s.pvHeading}>الخلية العصبية</p>
      <ul>
        <li>تنقل الإشارات الكهربائية عبر المحور العصبي.</li>
        <li>جهد الراحة نحو {MINUS_70} ملي فولت.</li>
        <li>
          مضخة <bdi dir="ltr">Na⁺/K⁺</bdi> تحافظ على جهد الراحة.
        </li>
      </ul>
    </div>
  );
}

function FlashcardPreview() {
  return (
    <div className={s.pvCard}>
      <p className={s.pvQuestion}>ما دور مضخة الصوديوم والبوتاسيوم؟</p>
      <p className={s.pvAnswer}>
        تُخرج 3 أيونات صوديوم وتُدخل 2 بوتاسيوم، فتحافظ على جهد الراحة.
      </p>
      <div className={s.pvRate}>
        <span>صعبة</span>
        <span>جيدة</span>
        <span>سهلة</span>
      </div>
    </div>
  );
}

function QuizPreview() {
  return (
    <div className={s.pvQuiz}>
      <p className={s.pvQuestion}>كم يبلغ جهد الراحة للخلية العصبية تقريبًا؟</p>
      <ul>
        <li>
          <bdi dir="ltr">+30</bdi> ملي فولت
        </li>
        <li className={s.pvCorrect}>{MINUS_70} ملي فولت</li>
        <li>صفر</li>
      </ul>
    </div>
  );
}

function MindMapPreview() {
  return (
    <svg viewBox="0 0 260 140" className={s.pvMap}>
      <g className={s.pvMapLines}>
        <path d="M130 70 L48 28" />
        <path d="M130 70 L48 112" />
        <path d="M130 70 L212 28" />
        <path d="M130 70 L212 112" />
      </g>
      <g className={s.pvMapNodes}>
        <rect
          x="88"
          y="54"
          width="84"
          height="32"
          rx="8"
          className={s.pvMapRoot}
        />
        <text x="130" y="75">
          الخلية العصبية
        </text>
        <rect x="8" y="14" width="80" height="28" rx="8" />
        <text x="48" y="33">
          المحور
        </text>
        <rect x="8" y="98" width="80" height="28" rx="8" />
        <text x="48" y="117">
          التشابك
        </text>
        <rect x="172" y="14" width="80" height="28" rx="8" />
        <text x="212" y="33">
          جهد الراحة
        </text>
        <rect x="172" y="98" width="80" height="28" rx="8" />
        <text x="212" y="117">
          المضخة
        </text>
      </g>
    </svg>
  );
}

function AssistantPreview() {
  return (
    <div className={s.pvChat}>
      <p className={s.pvAsk}>ليش تحتاج المضخة طاقة؟</p>
      <div className={s.pvReply}>
        <NiroSpark size={16} />
        <p>
          لأنها تنقل الأيونات عكس تدرّج تركيزها، وهذا لا يحدث تلقائيًا. (صفحة
          12)
        </p>
      </div>
    </div>
  );
}
