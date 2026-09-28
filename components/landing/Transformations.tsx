// The two sides of the before/after figures. "Before" is a dense English
// lecture page — the situation most Arab medicine/engineering students
// start from. "After" variants show what NiroLearn makes from that same
// page: an English-first summary with Arabic support (how the product
// treats English material), Exam Focus, flashcards, a mind map.
// Illustrations with example content; every figure's caption says so.
import t from "./transform.module.css";

const NEG_70 = <bdi dir="ltr">-70 mV</bdi>;

export function LecturePage() {
  return (
    <div className={t.lecture} lang="en" dir="ltr">
      <div className={t.lectureHead}>
        <span>Physiology · Lecture 7</span>
        <span>p. 37 / 212</span>
      </div>
      <p className={t.lectureTitle}>
        7.2 The resting potential and the nerve impulse
      </p>
      <p className={t.lectureText}>
        Neurons transmit electrical signals along the axon, away from the cell
        body. At rest the inside of the membrane is negative relative to the
        outside; the resting membrane potential is approximately -70 mV. This
        gradient is maintained by the Na+/K+ ATPase, which moves three sodium
        ions out of the cell and two potassium ions in for each ATP hydrolysed,
        and by the greater resting permeability of the membrane to potassium.
      </p>
      <div className={t.lectureFig}>
        <svg viewBox="0 0 120 60" aria-hidden="true">
          <polyline
            points="4,44 30,44 36,40 42,8 50,52 60,48 116,44"
            fill="none"
            stroke="#6c7180"
            strokeWidth="1.6"
          />
          <line
            x1="4"
            y1="36"
            x2="116"
            y2="36"
            stroke="#c9ccd4"
            strokeDasharray="3 3"
          />
        </svg>
        <span>
          Fig. 7.3 Phases of the action potential: depolarisation,
          repolarisation, hyperpolarisation and the refractory period.
        </span>
      </div>
      <p className={t.lectureText}>
        When a stimulus depolarises the membrane to threshold (about -55 mV),
        voltage-gated sodium channels open and sodium enters the cell, producing
        the rising phase of the action potential. Repolarisation follows as
        sodium channels inactivate and voltage-gated potassium channels open.
        During the absolute refractory period no second action potential can be
        generated, which limits firing frequency and keeps conduction
        one-directional along the axon…
      </p>
      <div className={t.lectureFade} />
    </div>
  );
}

function FocusNote() {
  return (
    <div className={t.focus}>
      <strong>Exam Focus · أرقام وحدود</strong>
      <p>
        جهد الراحة نحو {NEG_70}، وعتبة الإثارة نحو <bdi dir="ltr">-55 mV</bdi>.
      </p>
      <small>من صفحة 37</small>
    </div>
  );
}

export function AfterSummary() {
  return (
    <div className={t.after}>
      <div className={t.sumCard}>
        <p className={t.sumTitle}>
          ملخص الجزء 7.2: جهد الراحة والإشارة العصبية
        </p>
        <ul className={t.sumPoints} lang="en">
          <li>Resting membrane potential: about -70 mV (inside negative).</li>
          <li>Maintained by the Na+/K+ ATPase: 3 Na+ out, 2 K+ in.</li>
          <li>
            At threshold, voltage-gated Na+ channels open: action potential.
          </li>
        </ul>
        <p className={t.sumSupport}>
          ببساطة: الخلية العصبية وهي في راحة يكون داخلها سالبًا، والمضخة تحافظ
          على ذلك. وعندما يصل التنبيه إلى العتبة تنفتح قنوات الصوديوم فتنطلق
          الإشارة.
        </p>
      </div>
      <FocusNote />
      <ul className={t.terms} aria-label="مصطلحات">
        <li>
          جهد الفعل <bdi dir="ltr">Action potential</bdi>
        </li>
        <li>
          فترة الجموح <bdi dir="ltr">Refractory period</bdi>
        </li>
      </ul>
    </div>
  );
}

export function AfterDeck() {
  return (
    <div className={t.after}>
      <div className={t.deck}>
        <div className={t.deckCard}>
          <p className={t.deckQ}>كم يبلغ جهد الراحة للخلية العصبية تقريبًا؟</p>
          <p className={t.deckA}>نحو {NEG_70}، ويكون داخل الغشاء سالبًا.</p>
          <div className={t.deckRate}>
            <span>صعبة</span>
            <span>جيدة</span>
            <span>سهلة</span>
          </div>
        </div>
        <div className={t.deckCard}>
          <p className={t.deckQ}>ماذا تفعل مضخة الصوديوم والبوتاسيوم؟</p>
        </div>
        <div className={t.deckCard}>
          <p className={t.deckQ}>ما الذي يمنع جهد فعل ثانٍ مباشرة؟</p>
        </div>
      </div>
      <p className={t.deckDue}>12 بطاقة من هذا الجزء · 4 منها للمراجعة اليوم</p>
    </div>
  );
}

export function AfterMap() {
  return (
    <div className={t.after}>
      <svg
        viewBox="0 0 440 320"
        className={t.map}
        role="img"
        aria-label="خريطة ذهنية لدرس الإشارة العصبية"
      >
        <line x1="220" y1="160" x2="82" y2="52" />
        <line x1="220" y1="160" x2="358" y2="52" />
        <line x1="220" y1="160" x2="82" y2="268" />
        <line x1="220" y1="160" x2="358" y2="268" />
        <rect
          x="125"
          y="130"
          width="190"
          height="60"
          rx="14"
          className={t.mapRoot}
        />
        <text x="220" y="167" className={t.mapRootText}>
          الإشارة العصبية
        </text>

        <rect x="6" y="20" width="152" height="64" rx="12" />
        <text x="82" y="48">
          جهد الراحة
        </text>
        <text x="82" y="70" className={t.mapSub}>
          نحو -70 mV
        </text>

        <rect x="282" y="20" width="152" height="64" rx="12" />
        <text x="358" y="48">
          مضخة Na/K
        </text>
        <text x="358" y="70" className={t.mapSub}>
          3 خارج و2 داخل
        </text>

        <rect
          x="6"
          y="236"
          width="152"
          height="64"
          rx="12"
          className={t.mapHot}
        />
        <text x="82" y="264">
          جهد الفعل
        </text>
        <text x="82" y="286" className={t.mapSub}>
          العتبة نحو -55 mV
        </text>

        <rect x="282" y="236" width="152" height="64" rx="12" />
        <text x="358" y="264">
          فترة الجموح
        </text>
        <text x="358" y="286" className={t.mapSub}>
          اتجاه واحد للإشارة
        </text>
      </svg>
      <FocusNote />
    </div>
  );
}

export function AfterAll() {
  return (
    <div className={t.after}>
      <div className={t.sumCard}>
        <p className={t.sumTitle}>ملخص الجزء 7.2</p>
        <ul className={t.sumPoints} lang="en">
          <li>Resting membrane potential: about -70 mV.</li>
          <li>Na+/K+ ATPase: 3 Na+ out, 2 K+ in.</li>
        </ul>
        <p className={t.sumSupport}>
          ببساطة: داخل الخلية سالب وهي في راحة، والمضخة تحافظ على ذلك.
        </p>
      </div>
      <FocusNote />
      <div className={t.deckCard}>
        <p className={t.deckQ}>ماذا تفعل مضخة الصوديوم والبوتاسيوم؟</p>
        <div className={t.deckRate}>
          <span>صعبة</span>
          <span>جيدة</span>
          <span>سهلة</span>
        </div>
      </div>
    </div>
  );
}
