# NiroLearn — تدقيق SEO تقني

**تاريخ التدقيق:** 2 أكتوبر 2026  
**النطاق:** الموقع العام `https://nirolearn.com` وشفرة Next.js 15 (App Router).  
**خارج النطاق:** لا يثبت هذا التدقيق ترتيب الكلمات، أو حالة فهرسة Google، أو الزيارات، أو الروابط الخلفية، أو Core Web Vitals، أو أهلية rich results، أو ظهور NiroLearn في إجابات الذكاء الاصطناعي.

## الملخص التنفيذي

البنية العامة للموقع سليمة بدرجة كبيرة: الصفحات العامة مرئية في HTML الخادمي، ولها عناوين وأوصاف وcanonical، والصفحة الرئيسية وصفحات الأدوات لديها بيانات منظمة وصور مشاركة، و`robots.txt` و`sitemap.xml` موجودان.

المشكلة الوحيدة التي كانت تمنع توحيد الإشارات هي أن `www.nirolearn.com` كان يعرض نسخة `200` مكررة من صفحات `nirolearn.com` بدل إعادة توجيه دائمة إلى النطاق الأساسي. يعالج هذا التغيير ذلك في طبقة التطبيق، لكن يبقى ضبط التحويل نفسه عند Railway/DNS إجراء نشر مطلوبًا من المالك. لا يعني أي من هذه الإصلاحات ضمان ترتيب أو فهرسة أو ظهور في AI Overview.

## ما تم التحقق منه في الإنتاج

| الفحص                               | النتيجة               | الدليل/الأثر                                                                                                                               |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `https://nirolearn.com/sitemap.xml` | صالح ومتاح            | `200`، `application/xml`، TLS صالح، XML صحيح يحتوي 10 روابط canonical فريدة.                                                               |
| محتوى sitemap                       | صحيح                  | يضم `/` وصفحات الأدوات الأربع و`/pricing` و`/register` و`/contact` و`/privacy` و`/terms` فقط؛ لا يضم login أو URLs مستخدمين.               |
| `https://nirolearn.com/robots.txt`  | صالح                  | `200` و`text/plain` ويشير إلى sitemap الأساسي، ويحجب معظم مسارات التطبيق وAPI.                                                             |
| الصفحة العامة والمسارات العشر       | متاحة                 | كل مسار مفحوص أعاد `200`، وله `lang="ar"` و`dir="rtl"` وعنوان ووصف وcanonical على non-www.                                                 |
| صفحات المحتوى                       | سليمة                 | `/`, `/pdf-summary`, `/flashcards`, `/mind-map`, `/how-to-study` لديها `og:url` وصورة OG وJSON-LD مطابقين للمحتوى الظاهر.                  |
| صفحات المعاملات                     | سليمة                 | `/login` يعرض `noindex, follow` و`/home` يعرض `noindex, nofollow`.                                                                         |
| الرابط الداخلي العام                | لا روابط مكسورة مؤكدة | فحص روابط صفحات التسويق والقانون أظهر جميع الوجهات العامة `200`؛ `/account#delete-account` يحوّل للضيوف إلى login كما هو متوقع لمسار محمي. |

## النتائج والإصلاحات

### P0 — مضيف `www` مكرر

**الحالة قبل التغيير:** `https://www.nirolearn.com/` أعاد `200` بدل `301/308` إلى `https://nirolearn.com/`. كانت canonical tags تشير إلى non-www، وهذا يساعد محركات البحث لكنه لا يلغي النسخة التقنية المكررة أو يضمن تجميع كل الروابط الخارجية.

**الإصلاح في الشفرة:**

- `lib/canonical-host.ts`: قرار redirect خالص ومحدود للنطاق `www.nirolearn.com` فقط.
- `middleware.ts`: إعادة توجيه `308` قبل rewrite الجلسة، مع الاحتفاظ بالمسار وquery string.
- لا يمس redirect مضيفات Railway أو staging أو localhost أو مسارات auth/API من حيث السلوك الوظيفي.

**إجراء نشر مطلوب:** عيّن `nirolearn.com` مضيف Railway/DNS الأساسي، واضبط `www.nirolearn.com → https://nirolearn.com` أيضًا عند الحافة إن كانت المنصة تدعم ذلك. بعد النشر افحص أن Middleware يرى المضيف الخارجي الصحيح وأن Google OAuth وAuth.js وQStash ما زالت على الأصل المقصود. لا نغيّر متغيرات الإنتاج من هذا المستودع.

### P1 — تغطية robots للمسارات الخاصة الجديدة

كان `app/robots.ts` لا يسمي `/doctor` ولا `/question-sets`، رغم أن كليهما خلف المصادقة. أضيفا إلى قائمة `Disallow` مع المسارات الخاصة الحالية. هذا يقلل crawl غير المرغوب، **ولا يحل محل auth**؛ يبقى المنع الحقيقي في server layouts وtRPC.

### P2 — تطابق Open Graph للصفحات العامة غير المحتوى

كانت `/pricing`, `/register`, `/contact`, `/privacy`, `/terms` ترث صورة OG العامة وعنوان/وصفًا صحيحين، لكن بلا `og:url` صريح خاص بالصفحة. أصبحت metadata لكل صفحة تصرح بالرابط والعنوان والوصف نفسهم كما في canonical، دون تغيير نصوص المنتج أو أسعار الخطط أو التصميم.

### P3 — حماية الانحدار

لم تكن هناك اختبارات SEO مخصصة. أضيفت اختبارات Vitest بلا شبكة أو أسرار للتحقق من:

- حصر sitemap في `PUBLIC_PATHS` فقط.
- استبعاد login وhome وAPI وadmin ومسارات المستخدم الديناميكية.
- حجب كل route family الخاص في robots، ومنها doctor وquestion-sets.
- قرار canonical host، مع الاحتفاظ بـpathname وquery وعدم التأثير في preview/Railway/local.

## عناصر سليمة في الشفرة الحالية

- `lib/site.ts` هو مصدر عنوان الموقع والصفحات القابلة للفهرسة والـOG الأساسي.
- `app/layout.tsx` يضبط `metadataBase` و`lang="ar"` و`dir="rtl"`.
- `app/sitemap.ts` ثابت وحتمي ولا يقرأ قاعدة بيانات أو بيانات مستخدمين.
- `components/landing/StructuredData.tsx` يصف Organization وWebSite وWebApplication وFAQ الظاهر فقط.
- `components/landing/PageBits.tsx` يضيف WebPage/Article وBreadcrumb وFAQ للصفحات العامة؛ لا يصف بيانات الدراسة الخاصة.
- `public/llms.txt` يقدّم فهرسًا موجزًا للصفحات العامة وحقائق المنتج الحالية.
- لا توجد `hreflang` مضافة، وهذا صحيح حاليًا: لا توجد نسخ عربية وإنجليزية مكافئة على URLs مستقلة.

## ما لم يُثبت في هذا التدقيق

- ما إذا كانت Google اختارت canonical نفسه أو فهرست كل صفحة.
- ترتيب الكلمات أو الزيارات أو التحويلات أو الروابط الخلفية.
- أداء LCP/INP/CLS ميدانيًا أو في Lighthouse.
- أهلية أو ظهور FAQ/SoftwareApplication rich results.
- ظهور العلامة أو أي صفحة في Google AI Overviews أو في نماذج أخرى.

تحتاج هذه إلى Search Console وقياسات أداء وبيانات تحليلات بعد فترة من النشر؛ metadata أو schema وحدها ليست إثباتًا لها.

## قائمة تحقق بعد نشر مصرّح به

1. افحص `https://www.nirolearn.com/pdf-summary?source=test`؛ يجب أن ينتهي بتحويل واحد `308` إلى `https://nirolearn.com/pdf-summary?source=test`.
2. افحص `https://nirolearn.com/robots.txt` و`/sitemap.xml`: يجب أن يبقيا `200` بنوعي المحتوى `text/plain` و`application/xml`.
3. تأكد أن sitemap يحتوي 10 URLs non-www فقط، ولا يحتوي `/login` أو `/home` أو `/doctor` أو `/question-sets` أو أي ID مستخدم.
4. افحص source الصفحات الخمس المعدلة للتأكد أن canonical و`og:url` متساويان.
5. افحص syntax فقط عبر Schema Validator أو Rich Results Test للصفحة الرئيسية وصفحة أداة؛ النتيجة لا تضمن عرض rich result.
6. بعد التحقق، أرسل sitemap الأساسي أو أعد إرساله في Google Search Console Domain Property، ثم استخدم URL Inspection للصفحة الرئيسية وصفحة أداة.
7. راقب coverage وcanonical الذي تختاره Google وطلبات crawl خلال الأسابيع التالية قبل نسبة أي أثر للإصلاح.
