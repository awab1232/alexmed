// Small, decorative product previews (example content, labelled as such
// where they appear). Shared by the landing page and the tool pages.
import NiroSpark from "@/components/niro/NiroSpark";
import s from "./landing.module.css";

// A negative number kept left-to-right inside Arabic text. ASCII "-", not
// U+2212: the minus sign sits outside the preloaded font subsets, and in
// the hero it pulled in a late extra font file that delayed LCP.
export const MINUS_70 = <bdi dir="ltr">-70</bdi>;

export function SummaryPreview() {
  return (
    <div className={s.pvSummary}>
      <p className={s.pvHeading}>الخلية العصبية</p>
      <ul>
        <li>تنقل الإشارات الكهربائية عبر المحور العصبي.</li>
        <li>جهد الراحة نحو {MINUS_70} ملي فولت.</li>
        <li>مضخة الصوديوم والبوتاسيوم تحافظ على جهد الراحة.</li>
      </ul>
    </div>
  );
}

export function FlashcardPreview() {
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

export function QuizPreview() {
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

export function MindMapPreview() {
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

export function AssistantPreview() {
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
