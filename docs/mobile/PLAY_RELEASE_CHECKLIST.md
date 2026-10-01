# دليل إطلاق Google Play (أندرويد فقط) — Runbook

> مسار إطلاق **أندرويد أولًا مع تأجيل Apple**. كل خطوة بيد صاحب الحساب
> تقريبًا؛ الكود جاهز لها. هذا الملف هو **إجراء تنفيذي** بجانب الخارطة
> (`MOBILE_IMPLEMENTATION_ROADMAP.md`) — عُدّله عند أي تغيير.

## الوضع الحالي (لا تغيّره إلا عند الحاجة)
| عنصر | القيمة |
|---|---|
| `applicationId` | `com.nirolearn.app` (Kotlin namespace يبقى `com.nirolearn.nirolearn`) |
| `versionName` / `versionCode` | `1.0.0` / `1` (من `mobile/pubspec.yaml`) |
| الحالة على Play | **غير منشور** (قرار D5) — يبدأ نظيفًا من versionCode 1، بلا ترقية فوق تطبيق قديم |
| بيئة الإنتاج | `mobile/env/prod.json` → `https://nirolearn.com` + `GOOGLE_SERVER_CLIENT_ID` (معرّف عميل الويب موجود) |
| صلاحيات Manifest | `INTERNET` فقط (الكاميرا عبر Intent النظام، بلا إذن CAMERA) |
| النسخ الاحتياطي | `allowBackup=false` + `dataExtractionRules` — مفعّلة |
| سياسة الخصوصية | منشورة على `https://nirolearn.com/privacy` (بالعربية) |
| نموذج أمان البيانات | مسودة في [`PLAY_DATA_SAFETY.md`](./PLAY_DATA_SAFETY.md) |

---

## الخطوة 1 — إنشاء مفتاح التوقيع (بيدك، مرّة واحدة فقط)
المفتاح هو **هوية التطبيق** على Play إلى الأبد؛ إذا ضاع فلا يمكنك تحديث التطبيق.

```bash
keytool -genkeypair -v -keystore nirolearn-release.keystore -alias nirolearn \
  -keyalg RSA -keysize 2048 -validity 10000
```
- احفظه **خارج المستودع** (مثلًا `C:\Users\user\secrets\nirolearn-release.keystore`).
- احتفظ بكلمتَي المرور (store + key) في مكان آمن منفصل، وخذ **نسخة احتياطية**.
- ملفه مُستثنى من git بالفعل (`mobile/android/.gitignore`: `**/*.keystore`, `**/*.jks`).
- `keytool` يأتي مع JDK (متوفر مع Android Studio).

## الخطوة 2 — ربط التوقيع بالبناء
1. أنشئ `mobile/android/key.properties` (مستثنى من git تلقائيًا):
   ```properties
   storePassword=<كلمة مرور المتجر>
   keyPassword=<كلمة مرور المفتاح>
   keyAlias=nirolearn
   storeFile=C:/Users/user/secrets/nirolearn-release.keystore
   ```
2. عدّل `mobile/android/app/build.gradle.kts` لقراءة `key.properties` مع **البقاء على مفاتيح debug إذا غاب الملف** (حتى لا يُشحن شيء بالخطأ):
   ```kotlin
   import java.util.Properties
   import java.io.FileInputStream

   val keystoreProperties = Properties()
   val keystorePropertiesFile = rootProject.file("key.properties")
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(FileInputStream(keystorePropertiesFile))
   }

   android {
       // ...(ابقِ الباقي كما هو)...
       signingConfigs {
           create("release") {
               if (keystorePropertiesFile.exists()) {
                   keyAlias = keystoreProperties["keyAlias"] as String
                   keyPassword = keystoreProperties["keyPassword"] as String
                   storeFile = file(keystoreProperties["storeFile"] as String)
                   storePassword = keystoreProperties["storePassword"] as String
               }
           }
       }
       buildTypes {
           release {
               signingConfig = if (keystorePropertiesFile.exists())
                   signingConfigs.getByName("release")
               else
                   signingConfigs.getByName("debug")
           }
       }
   }
   ```
> يمكنك أن تطلب مني تطبيق تعديل `build.gradle.kts` هذا فور وجود الملف،
> ثم أتحقق من `flutter analyze` والاختبارات قبل الالتزام.

## الخطوة 3 — حساب Play Console + إنشاء التطبيق + Play App Signing
1. أنشئ/سجّل في **Google Play Console** (بريدك).
2. **إنشاء تطبيق** باسم NiroLearn، اختَر اللغة، ثم:
   - **App signing** → فعّل **Play App Signing** (يوصى به): ارفع بصمة مفتاح
     الرفع، وPlay يولّد مفتاح التوقيع النهائي ويديره.
3. أنشئ **الـ upload key** إن لم تفعل ذلك في الخطوة 1، واربط بصمته
   (Play App Signing يسمح لك بتوليده من داخل وحدة التحكم).
4. اكتب معرّف الحزمة `com.nirolearn.app` في صفحة الإعدادات.

## الخطوة 4 — عميل Google OAuth للأندرويد (لتفعيل زر Google)
زر Google في النسخة المنشورة لن يعمل إلا بعميل OAuth من نوع **Android**:
1. **Google Cloud Console** → APIs & Services → Credentials → Create
   credentials → **OAuth client ID** → نوع **Android**.
2. اسم الحزمة: `com.nirolearn.app`.
3. أضف **بصمة SHA-1** لمفتاح الرفع **وبصمة SHA-1 لمفتاح Play App Signing**
   (تجد الثانية في Play Console → App signing → App signing key certificate).
   لاستخراج بصمة مفتاحك:
   ```bash
   keytool -list -v -keystore nirolearn-release.keystore -alias nirolearn \
     | grep -A2 "Certificate fingerprints"
   ```
4. `serverClientId` (معرّف الويب الذي يتحقق منه الخادم في `aud`) موجود فعلًا في
   `env/prod.json` — لا يحتاج تغييرًا.

## الخطوة 5 — إعلانات محتوى التطبيق (كلها في Play Console)
- **App access**: التطبيق خلف تسجيل دخول. جهّز **حساب مراجعة** (اختر واحدًا):
  - حساب Google تجريبي، أو
  - حساب برقم هاتف + كلمة مرور مُنشأ مسبقًا (التسجيل بالهاتف يحتاج SMS حقيقي،
    فلا يصلح أن يسجّل المراجع بنفسه). سجّل بياناته في Play Console.
- **Data safety**: انقل محتوى [`PLAY_DATA_SAFETY.md`](./PLAY_DATA_SAFETY.md)
  (يُجمع/يُشارك = نعم، التشفير أثناء النقل = نعم، الحذف = نعم عبر
  `حسابي ← الملف الدراسي ← حذف الحساب`).
- **Content rating** (استبيان IARC): التطبيق فيه **محتوى من إنشاء المستخدم**
  (مشاركة كتب/ملفات أسئلة، رسائل، محادثات المساعد) — أجب عن UGC والاعتدال.
- **Target audience**: اختر الحد الأدنى للعمر (المقترح **13+** لوجود الحسابات
  وUGC) — قرارك.
- **Ads**: لا إعلانات. **Financial features**: لا (لا مدفوعات داخل التطبيق).
- **Privacy policy URL**: `https://nirolearn.com/privacy`.

## الخطوة 6 — قرار الفحص قبل البناء النهائي
قاعدة المشروع: **لا نختبر ضد الإنتاج**، لكن الإطلاق سيوجّه التطبيق للإنتاج.
اختر أحد المسارين قبل الشحن:
- **أ) بيئة staging (D1)** — الموصى به: مشروع Supabase + خدمة Railway + دلو R2
  + مفاتيح QStash (+ Vonage للـ SMS) كما في `ENVIRONMENTS.md` §5، ثم تمرير
  المسارات الحيّة هناك.
- **ب) Smoke على الإنتاج** — حساب تجريبي قابل للحذف، فحص قراءة/رفع/ملف/AI،
  دون مساس ببيانات المستخدمين الحقيقية. أسرع لكنه أضعف أمانًا.

## الخطوة 7 — بناء الحزمة الموقّعة (AAB)
بعد الخطوة 2 (ملف التوقيع مربوط) والخطوة 6:
```bash
cd mobile
export PATH="/c/Users/user/dev/flutter/bin:$PATH"
flutter gen-l10n
dart format lib test integration_test
flutter analyze          # يجب: No issues found!
flutter test             # يجب: All tests passed!
flutter build appbundle --release --dart-define-from-file=env/prod.json
```
الناتج: `mobile/build/app/outputs/bundle/release/app-release.aab`.
- **زيادة `versionCode` قبل كل رفع**: عدّل `version: 1.0.0+N` في
  `mobile/pubspec.yaml` (N يتزايد، لا يثبت).
- لا تبنِ **APK عاديًا** للرفع — الحزمة (AAB) فقط، وPlay يولّد الـ APK.

## الخطوة 8 — الرفع للـ internal track + اختبار
1. Play Console → Testing → **Internal testing** → أنشئ إصدارًا وارفع الـ AAB.
2. أضف مختبِرين (بريدك + أجهزتك)، فعّل الـ track.
3. ثبّت التحديث يدويًا من الرابط وأكّد أن الفحص يمر على جهاز حقيقي.

## الخطوة 9 — جولة QA على أندرويد (P19 المختزلة) + قائمة المتجر
- **الأجهزة**: Pixel بآخر إصدار + جهاز ضعيف (Android 8/9).
- **الفحوص**: تسجيل دخول (هاتف + Google)، رفع ملف، قراءة PDF، AI، لعبة، مشاركة،
  الوضع دون اتصال، TalkBack، ميزانيات الأداء (P16)، لا انهيارات.
- **قائمة المتجر**: وصف/لقطات شاشة بالعربية والإنجليزية (20.1).

## الخطوة 10 — الإطلاق التدريجي + المراقبة
1. **Closed/Open beta** إن رغبت، ثم **Production** بطرح تدريجي:
   10% ← 50% ← 100%.
2. راقب **Sentry** (عند تفعيله، مهمة 1.5) وسجلات الخادم 7 أيام (20.3).
3. **احتفظ بمفتاح الرفع + كلمة المرور إلى الأبد** — أي فقدان يمنع التحديثات.

---

## قائمة تسليم مدمجة
- [ ] 1. keystore أُنشئ وحُفظ بنسخة احتياطية خارج المستودع
- [ ] 2. `key.properties` + تعديل `build.gradle.kts` مربوط ومُختبَر
- [ ] 3. Play Console: التطبيق أُنشئ + Play App Signing مفعّل
- [ ] 4. عميل Google OAuth (Android) بشعيرتي الرفع والتوقيع
- [ ] 5. App access (حساب مراجعة) + Data safety + تصنيف المحتوى + الجمهور
- [ ] 6. قرار الفحص: staging (D1) أو smoke على الإنتاج
- [ ] 7. AAB موقّع بـ versionCode متزايد
- [ ] 8. Internal track + تثبيت اختباري ناجح
- [ ] 9. QA أندرويد + قائمة المتجر واللقطات
- [ ] 10. طرح تدريجي + مراقبة 7 أيام

> مؤجّل عمدًا (خاص بـ Apple، لا يؤثر على أندرويد): P18 iOS، D2، G3
> Sign in with Apple، G10 بلاغ المحتوى، وكل أجزاء P19/P20 الخاصة بـ iOS.
