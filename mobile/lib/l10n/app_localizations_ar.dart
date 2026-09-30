// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appName => 'NiroLearn';

  @override
  String get tabHome => 'الرئيسية';

  @override
  String get tabGames => 'ألعاب';

  @override
  String get tabAdd => 'إضافة';

  @override
  String get tabNiro => 'Niro';

  @override
  String get tabAccount => 'حسابي';

  @override
  String get actionRetry => 'أعد المحاولة';

  @override
  String get actionCancel => 'إلغاء';

  @override
  String get actionConfirm => 'تأكيد';

  @override
  String get actionClose => 'إغلاق';

  @override
  String get actionSave => 'حفظ';

  @override
  String get actionContinue => 'متابعة';

  @override
  String get loading => 'جاري التحميل…';

  @override
  String get offlineBanner => 'أنت غير متصل — يظهر آخر ما حُفظ على جهازك.';

  @override
  String get emptyTitle => 'لا يوجد شيء هنا بعد';

  @override
  String get errorTitle => 'تعذّر التحميل';

  @override
  String get errorNetwork =>
      'تعذّر الاتصال. تحقق من الإنترنت ثم حاول مرة أخرى.';

  @override
  String get errorSessionExpired => 'انتهت الجلسة. سجّل الدخول مرة أخرى.';

  @override
  String get errorForbidden => 'غير مسموح لك بالوصول إلى هذا المحتوى.';

  @override
  String get errorNotFound => 'غير متاح.';

  @override
  String get errorRateLimited => 'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.';

  @override
  String get errorServer => 'حدث خطأ في الخادم. حاول مرة أخرى بعد قليل.';

  @override
  String get errorRejected => 'تعذّر تنفيذ الطلب.';

  @override
  String underConstruction(String phase) {
    return 'قيد البناء — $phase';
  }

  @override
  String get welcomeTitle => 'مرحبًا';

  @override
  String get welcomeHeadline => 'ذاكر بذكاء مع Niro';

  @override
  String get welcomeBody =>
      'ارفع ملفك، ونحوّله لملخص وبطاقات واختبارات بالعربي.';

  @override
  String get welcomeSignIn => 'تسجيل الدخول';

  @override
  String get welcomeCreateAccount => 'إنشاء حساب';

  @override
  String get loginTitle => 'تسجيل الدخول';

  @override
  String get loginSubtitle => 'مرحبًا بعودتك إلى NiroLearn';

  @override
  String get loginIdentifier => 'رقم الهاتف أو البريد الإلكتروني';

  @override
  String get loginPassword => 'كلمة المرور';

  @override
  String get loginSubmit => 'دخول';

  @override
  String get loginSubmitting => 'جاري الدخول...';

  @override
  String get loginNoAccount => 'ليس لديك حساب؟';

  @override
  String get loginCreateAccount => 'أنشئ حسابًا';

  @override
  String get loginFillBoth => 'أدخل رقم الهاتف (أو البريد) وكلمة المرور.';

  @override
  String get showPassword => 'إظهار كلمة المرور';

  @override
  String get hidePassword => 'إخفاء كلمة المرور';

  @override
  String get sessionEndedNotice => 'انتهت الجلسة. سجّل الدخول مرة أخرى.';

  @override
  String get registerTitle => 'إنشاء حساب';

  @override
  String get registerPhoneStep => 'رقم هاتفك';

  @override
  String get registerPhoneHint => 'نرسل لك كودًا برسالة نصية للتأكد من الرقم.';

  @override
  String get registerCountry => 'الدولة';

  @override
  String get registerPhone => 'رقم الموبايل';

  @override
  String get registerSendCode => 'أرسل الكود';

  @override
  String get registerInvalidPhone =>
      'رقم الهاتف غير صحيح. تأكد من الرقم ومن رمز الدولة.';

  @override
  String get registerCodeStep => 'أدخل الكود';

  @override
  String registerCodeSentTo(String phone) {
    return 'أرسلنا كودًا من 6 أرقام إلى $phone';
  }

  @override
  String get registerCode => 'الكود';

  @override
  String get registerVerify => 'تأكيد';

  @override
  String get registerResend => 'أعد إرسال الكود';

  @override
  String registerResendIn(int seconds) {
    return 'إعادة الإرسال بعد $seconds ث';
  }

  @override
  String get registerChangePhone => 'غيّر الرقم';

  @override
  String get registerDetailsStep => 'بياناتك';

  @override
  String get registerName => 'الاسم';

  @override
  String get registerNameError => 'اكتب اسمك (حرفين على الأقل).';

  @override
  String get registerPasswordError => 'كلمة المرور لازم تكون 8 أحرف على الأقل.';

  @override
  String get registerSubmit => 'إنشاء الحساب';

  @override
  String get registerHaveAccount => 'لديك حساب؟';

  @override
  String get registerTerms =>
      'بإنشاء الحساب توافق على سياسة الاستخدام وسياسة الخصوصية.';

  @override
  String get greetingNight => 'سهرة دراسة';

  @override
  String get greetingMorning => 'صباح الخير';

  @override
  String get greetingEvening => 'مساء الخير';

  @override
  String greetingWithName(String greeting, String name) {
    return '$greeting، $name';
  }

  @override
  String nextDueTitle(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count بطاقة جاهزة للمراجعة',
      one: 'بطاقة واحدة جاهزة للمراجعة',
    );
    return '$_temp0';
  }

  @override
  String nextDueDetail(int minutes) {
    return 'حوالي $minutes دقيقة، والمراجعة في وقتها تثبّت المعلومة.';
  }

  @override
  String get nextDueAction => 'ابدأ المراجعة';

  @override
  String nextPreparingTitle(String title) {
    return 'نجهّز «$title»';
  }

  @override
  String get nextPreparingDetail =>
      'نقرأ الصفحات ونقسّمها لفصول. تقدر تفتحه وتتابع التقدّم.';

  @override
  String get nextOpenBook => 'افتح الكتاب';

  @override
  String nextContinueTitle(String title) {
    return 'تابع «$title»';
  }

  @override
  String get nextContinueDetail =>
      'لا يوجد شيء مستحق للمراجعة الآن. أكمل من حيث توقفت.';

  @override
  String get nextContinueAction => 'تابع الدراسة';

  @override
  String get nextFirstTitle => 'ارفع أول كتاب لك';

  @override
  String get nextFirstDetail =>
      'ملف PDF من مقرّرك يكفي. نحوّله لبطاقات وأسئلة وملخص وخريطة ذهنية.';

  @override
  String get nextFirstAction => 'ارفع كتابًا';

  @override
  String examIn(String name, String when) {
    return 'امتحان $name $when';
  }

  @override
  String get daysToday => 'اليوم';

  @override
  String get daysTomorrow => 'غدًا';

  @override
  String get daysTwo => 'بعد يومين';

  @override
  String daysFew(int days) {
    return 'بعد $days أيام';
  }

  @override
  String daysMany(int days) {
    return 'بعد $days يومًا';
  }

  @override
  String get yourBooks => 'كتبك';

  @override
  String get bookReady => 'جاهز للدراسة';

  @override
  String bookPartsReady(int done, int total) {
    return '$done من $total أجزاء جاهزة';
  }

  @override
  String get bookPreparing => 'نجهّز أدوات الدراسة…';

  @override
  String get bookReading => 'نقرأ الصفحات…';

  @override
  String sharedPending(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'لديك $count طلبات مشاركة جديدة',
      one: 'لديك طلب مشاركة جديد',
    );
    return '$_temp0';
  }

  @override
  String get sharedPendingDetail => 'زميلك يريد مشاركة ملف دراسي جاهز معك';

  @override
  String get sharedWithMe => 'مشترك معي';

  @override
  String get sharedWithMeDetail => 'ملفات شاركها معك زملاؤك';

  @override
  String sharedFrom(String owner) {
    return 'مشترك من $owner';
  }

  @override
  String get sharedColleague => 'زميل';

  @override
  String get myFolders => 'مجلداتي';

  @override
  String get newFolder => 'مجلد جديد';

  @override
  String get foldersEmpty =>
      'لا توجد مجلدات بعد. المجلد يجمع كتب مادة واحدة وملفات أسئلتها.';

  @override
  String get createFolder => 'أنشئ مجلدًا';

  @override
  String folderBooks(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count كتب',
      one: 'كتاب واحد',
    );
    return '$_temp0';
  }

  @override
  String folderDecks(int count) {
    return '، $count ملف أسئلة';
  }

  @override
  String folderUpdated(String date) {
    return '، آخر تحديث $date';
  }

  @override
  String get searchFolders => 'ابحث عن مجلد...';

  @override
  String get noMatches => 'لا نتائج مطابقة';

  @override
  String get noMatchesDetail => 'جرّب اسمًا آخر للبحث.';

  @override
  String get folderName => 'اسم المجلد';

  @override
  String get folderNameHint => 'مثال: تشريح، رياضيات 1';

  @override
  String get folderType => 'نوع المادة';

  @override
  String get folderCreate => 'إنشاء';

  @override
  String get folderCreateError =>
      'تعذّر إنشاء المجلد. تحقق من الاسم وحاول مرة أخرى.';

  @override
  String get folderLoadError => 'تعذر تحميل ملفاتك';

  @override
  String get folderEmpty => 'لا توجد ملفات في هذا المجلد بعد';

  @override
  String get addFile => 'إضافة ملف';

  @override
  String folderSummary(String type, int count) {
    return '$type · $count ملف';
  }

  @override
  String get questionFilesSection => 'ملفات الأسئلة';

  @override
  String get questionFileBadge => 'ملف أسئلة';

  @override
  String deckMeta(int cards, int pages) {
    return '$cards بطاقة · $pages صفحة';
  }

  @override
  String bookMeta(int pages) {
    return '$pages صفحة';
  }

  @override
  String get moveTo => 'نقل إلى مجلد';

  @override
  String get noFolder => 'بدون مادة';

  @override
  String get moved => 'تم النقل.';

  @override
  String get renameFolder => 'إعادة التسمية';

  @override
  String get deleteFolder => 'حذف المجلد';

  @override
  String get deleteFolderTitle => 'حذف المجلد؟';

  @override
  String get deleteFolderBody =>
      'يُحذف المجلد فقط. الكتب وملفات الأسئلة التي فيه تبقى في حسابك بدون مادة.';

  @override
  String get folderActions => 'خيارات المجلد';

  @override
  String get saved => 'تم الحفظ.';

  @override
  String get addSheetTitle => 'ماذا تريد أن تضيف؟';

  @override
  String get addBook => 'كتاب دراسي';

  @override
  String get addBookDetail => 'فصول، شرح، بطاقات، اختبارات وملخص لكل فصل.';

  @override
  String get addQuestionFile => 'ملف أسئلة';

  @override
  String get addQuestionFileDetail => 'حوّل ملف أسئلة إلى بطاقات مذاكرة سريعة.';

  @override
  String get addFolderDetail => 'نظّم ملفاتك حسب المادة.';

  @override
  String get addDoctorCode => 'كود من دكتورك';

  @override
  String get addDoctorCodeDetail => 'أضف مجموعة أسئلة محمية بكود الوصول.';

  @override
  String get accountGroup => 'الحساب';

  @override
  String get studyGroup => 'دراستي';

  @override
  String get adminGroup => 'الإدارة';

  @override
  String get helpGroup => 'المساعدة';

  @override
  String get studyProfile => 'الملف الدراسي';

  @override
  String get studyProfileEmpty => 'أضف تخصصك وسنتك';

  @override
  String get academicYear => 'السنة الدراسية';

  @override
  String get academicYearHint => 'مثال: السنة الثالثة';

  @override
  String get specialty => 'التخصص';

  @override
  String get specialtyHint => 'مثال: طب بشري';

  @override
  String get usernameRow => 'اسم المستخدم للمشاركة';

  @override
  String get usernameEmpty => 'لم تختره بعد';

  @override
  String get planRow => 'الباقة والاستخدام';

  @override
  String get questionFilesRow => 'ملفات الأسئلة';

  @override
  String get statsRow => 'إحصائياتي';

  @override
  String get doctorDashboard => 'لوحة الدكتور';

  @override
  String get doctorApply => 'انضم كدكتور';

  @override
  String get doctorPending => 'طلب الدكتور قيد المراجعة';

  @override
  String get doctorRejected => 'طلب الدكتور لم يُقبل';

  @override
  String get doctorSuspended => 'صلاحيات الدكتور موقوفة';

  @override
  String get privacyPolicy => 'سياسة الخصوصية';

  @override
  String get termsOfUse => 'سياسة الاستخدام';

  @override
  String get contactUs => 'تواصل معنا';

  @override
  String get signOut => 'تسجيل الخروج';

  @override
  String get signOutConfirmTitle => 'تسجيل الخروج؟';

  @override
  String get signOutConfirmBody =>
      'ستحتاج لتسجيل الدخول مرة أخرى على هذا الجهاز.';

  @override
  String get deleteAccount => 'حذف الحساب';

  @override
  String get deleteAccountTitle => 'حذف الحساب نهائيًا؟';

  @override
  String get deleteAccountBody =>
      'يُحذف حسابك مع كل ملفاتك وصورها، والملخصات والبطاقات والأسئلة، وتقدّمك ومحادثاتك ومشاركاتك. لا يمكن التراجع عن ذلك.';

  @override
  String get deleteAccountTypeWord => 'للتأكيد اكتب كلمة «حذف»';

  @override
  String get deleteAccountConfirmWord => 'حذف';

  @override
  String get deleteAccountSubmit => 'حذف نهائي';

  @override
  String get planTitle => 'باقتك في NiroLearn';

  @override
  String get planFree => 'أنت تستخدم الباقة المجانية.';

  @override
  String planActiveUntil(String date) {
    return 'فعّالة حتى $date';
  }

  @override
  String get planActive => 'فعّالة';

  @override
  String get usageAssistant => 'مساعد Niro';

  @override
  String get usageQuestionFiles => 'ملفات الأسئلة';

  @override
  String get usageStudyFiles => 'ملفات الدراسة';

  @override
  String get usageToday => 'اليوم';

  @override
  String usageOf(int used, int limit) {
    return '$used من $limit';
  }

  @override
  String get usageUnlimited => 'غير محدود';

  @override
  String get usageResets => 'يتجدد غدًا';

  @override
  String maxFileSize(int mb) {
    return 'أقصى حجم للملف: $mb ميغابايت';
  }

  @override
  String get openInBrowserFailed => 'تعذّر فتح الصفحة.';

  @override
  String get mirrorTitle => 'ملف أسئلة ← بطاقات';

  @override
  String get mirrorIntro =>
      'ارفع أسئلة مادتك، ونرتّبها لك بطاقات: السؤال، الجواب، الشرح، والكلمة المفتاحية — بالعربي والإنجليزي.';

  @override
  String get mirrorModePdf => 'ملف PDF';

  @override
  String get mirrorModeText => 'نص أسئلة';

  @override
  String get mirrorStepFile => 'الملف';

  @override
  String get mirrorStepText => 'الأسئلة';

  @override
  String get mirrorStepDepth => 'مستوى الشرح';

  @override
  String get mirrorStepFolder => 'المجلد';

  @override
  String get mirrorPickFile => 'اختر ملف PDF';

  @override
  String get mirrorPickHint => 'يدعم الملفات الكبيرة وPDF المصوّر (OCR).';

  @override
  String mirrorFileReady(String size) {
    return '$size · جاهز للتحليل';
  }

  @override
  String get mirrorChangeFile => 'تغيير';

  @override
  String mirrorMaxSize(int mb) {
    return 'الحد الأقصى في باقتك $mb ميغابايت';
  }

  @override
  String get depthQuick => 'سريع';

  @override
  String get depthQuickCaption => 'مراجعة خاطفة';

  @override
  String get depthBalanced => 'متوازن';

  @override
  String get depthBalancedCaption => 'الأفضل للامتحان';

  @override
  String get depthDetailed => 'مفصّل';

  @override
  String get depthDetailedCaption => 'شرح أعمق';

  @override
  String get depthRecommended => 'موصى به';

  @override
  String get mirrorChooseFolder => 'اختر مجلدًا';

  @override
  String get mirrorNoFolders => 'لا توجد مجلدات بعد — أنشئ واحدًا.';

  @override
  String get mirrorTextHint =>
      'الصق الأسئلة هنا، مع خياراتها وإجاباتها إن وُجدت…';

  @override
  String mirrorTextCount(int count) {
    return '$count حرف';
  }

  @override
  String get mirrorTextTooShort => 'الصق نص الأسئلة أولًا (نص قصير جدًا).';

  @override
  String get mirrorTextTooLong =>
      'النص أطول من 60,000 حرف. قسّمه على دفعتين وأضف الثانية لنفس الملف.';

  @override
  String get mirrorTextDestination => 'أين تُضاف البطاقات؟';

  @override
  String get mirrorTextNewFile => 'ملف جديد';

  @override
  String get mirrorTextAppend => 'إضافة لملف موجود';

  @override
  String get mirrorTextTitle => 'اسم الملف (اختياري)';

  @override
  String get mirrorTextTitleHint => 'مثال: أسئلة الفصل الثالث';

  @override
  String get mirrorChooseDeck => 'اختر الملف';

  @override
  String get mirrorSubmit => 'حوّل إلى بطاقات';

  @override
  String mirrorUploading(int percent) {
    return 'نرفع الملف… $percent%';
  }

  @override
  String get mirrorStarting => 'نجهّز الملف للتوليد…';

  @override
  String get mirrorCancelUpload => 'إلغاء الرفع';

  @override
  String get mirrorDisclaimer =>
      'أداة مساعدة للمذاكرة وليست بديلًا عن مرجع المادة. راجع البطاقات المعلّمة للتدقيق.';

  @override
  String get mirrorJobReading => 'نقرأ الملف ونجهّزه…';

  @override
  String get mirrorJobReadingHint =>
      'قد يستغرق هذا وقتًا أطول للملفات الممسوحة ضوئيًا. تقدر تطلع وترجع لاحقًا دون فقدان التقدم.';

  @override
  String get mirrorJobGenerating => 'نجهّز بطاقاتك';

  @override
  String mirrorJobProgress(int done, int total) {
    return 'تم $done من $total جزءًا';
  }

  @override
  String mirrorJobMeta(int pages, int batches) {
    return '$pages صفحة · $batches جزء';
  }

  @override
  String get mirrorStartStudying => 'ابدأ المذاكرة';

  @override
  String get mirrorStartEarly =>
      'أول البطاقات جاهزة — تقدر تبدأ الآن والباقي يوصل تلقائيًا.';

  @override
  String get mirrorJobComplete => 'اكتمل التوليد.';

  @override
  String get mirrorJobFailed =>
      'تعذّرت قراءة هذا الملف. جرّب رفع نسخة أخرى منه.';

  @override
  String get mirrorRetryPages => 'إعادة محاولة الصفحات الفاشلة';

  @override
  String mirrorPartial(int count) {
    return 'اكتمل معظم الملف، لكن $count جزءًا تعذّر توليده.';
  }

  @override
  String mirrorBatchPages(String range) {
    return 'صفحة $range';
  }

  @override
  String get mirrorBatchFailed => 'تعذّر التوليد';

  @override
  String get mirrorUploadNew => 'ارفع ملفًا جديدًا';

  @override
  String deckCardOf(int index, int total) {
    return 'بطاقة $index من $total';
  }

  @override
  String get deckAll => 'الكل';

  @override
  String get deckNeedsReview => 'تحتاج مراجعة';

  @override
  String get deckSearch => 'ابحث في السؤال أو الكلمة المفتاحية…';

  @override
  String get deckEmpty => 'لا توجد بطاقات هنا';

  @override
  String get deckEmptyHint => 'جرّب إزالة البحث أو الفلتر.';

  @override
  String get deckWaiting => 'نجهّز أول البطاقات…';

  @override
  String deckLive(int count) {
    return 'جاري تجهيز المزيد — $count بطاقة جاهزة حتى الآن.';
  }

  @override
  String get deckAllReady => 'اكتملت كل البطاقات.';

  @override
  String deckFailedParts(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'تعذر توليد $count أجزاء من الملف.',
      one: 'تعذر توليد جزء واحد من الملف.',
    );
    return '$_temp0';
  }

  @override
  String get deckDetails => 'التفاصيل';

  @override
  String get deckPrevious => 'السابقة';

  @override
  String get deckNext => 'التالية';

  @override
  String get deckAddQuestions => 'إضافة أسئلة';

  @override
  String get deckDelete => 'حذف الملف';

  @override
  String get deckDeleteTitle => 'حذف ملف الأسئلة؟';

  @override
  String get deckDeleteBody => 'تُحذف كل بطاقات هذا الملف نهائيًا.';

  @override
  String get deckMore => 'خيارات الملف';

  @override
  String cardPage(int page) {
    return 'صفحة $page';
  }

  @override
  String get cardClear => 'واضحة';

  @override
  String cardConfidence(String level) {
    return 'ثقة $level';
  }

  @override
  String get confidenceHigh => 'عالية';

  @override
  String get confidenceMedium => 'متوسطة';

  @override
  String get confidenceLow => 'منخفضة';

  @override
  String get cardReveal => 'اظهر الإجابة والشرح';

  @override
  String get cardCorrect => 'إجابة صحيحة';

  @override
  String get cardWrong => 'إجابة خاطئة';

  @override
  String get cardAnswer => 'الإجابة';

  @override
  String get cardExplanation => 'الشرح';

  @override
  String get cardKeyIdea => 'الفكرة الأساسية';

  @override
  String get cardKeyword => 'الكلمة المفتاحية';

  @override
  String get cardShowTranslation => 'عرض الترجمة';

  @override
  String get cardHideTranslation => 'إخفاء الترجمة';

  @override
  String get cardTryAgain => 'إعادة';

  @override
  String get cardImageFailed => 'تعذّر تحميل الصورة';

  @override
  String get questionFilesTitle => 'ملفات الأسئلة';

  @override
  String get questionFilesEmpty => 'لا توجد ملفات أسئلة بعد';

  @override
  String get questionFilesEmptyHint =>
      'ارفع ملفك الأول وسيظهر هنا بعد التوليد.';

  @override
  String get questionFilesNew => 'ملف جديد';

  @override
  String get bookUploadTitle => 'رفع كتاب دراسي';

  @override
  String get bookUploadIntro =>
      'ارفع كتابك مهما كان حجمه، ونقسّمه لك لفصول صغيرة ونحلّل كل فصل على حدة.';

  @override
  String get bookStepFile => 'الكتاب';

  @override
  String get bookStepProfile => 'نوع المادة';

  @override
  String get bookProfileHint => 'يوجّه التحليل لطريقة مادتك.';

  @override
  String get bookSubmit => 'حوّل إلى فصول';

  @override
  String get bookStarting => 'جاري تجهيز الكتاب…';

  @override
  String get bookKeepOpen =>
      'أبقِ التطبيق مفتوحًا حتى يكتمل الرفع — بعده يكمل التجهيز على الخادم.';

  @override
  String bookQuotaLeft(int remaining, int limit) {
    return 'متبقي اليوم $remaining من $limit ملفات دراسة';
  }

  @override
  String get bookDuplicateTitle => 'عندك ملف بنفس الاسم';

  @override
  String bookDuplicateBody(String title) {
    return '«$title» موجود في مكتبتك. افتحه بدل رفعه مرة ثانية، أو ارفع هذا كنسخة جديدة.';
  }

  @override
  String get bookDuplicateOpen => 'افتح الموجود';

  @override
  String bookMetaParts(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count أجزاء',
      one: 'جزء واحد',
    );
    return '$_temp0';
  }

  @override
  String get bookStudyTitle => 'ادرس هذا الكتاب';

  @override
  String get bookToolsAfterReading =>
      'أدوات الدراسة تظهر هنا بعد ما نخلّص قراءة صفحات الملف.';

  @override
  String get bookGenerateBody =>
      'جهّز البطاقات والأسئلة والملخص والخريطة الذهنية لهذا الكتاب بضغطة واحدة. تقدر تطلع من التطبيق، التجهيز يكمل لحاله.';

  @override
  String get bookGenerate => 'جهّز أدوات الدراسة';

  @override
  String get bookGenerateError =>
      'تعذّر بدء التجهيز. تحقق من اتصالك وحاول مرة أخرى.';

  @override
  String get bookSharedNotStarted => 'لم يبدأ صاحب الملف التجهيز بعد.';

  @override
  String bookSharedFrom(String name) {
    return 'مشترك من $name';
  }

  @override
  String get toolCards => 'بطاقات';

  @override
  String get toolCardsPurpose => 'احفظ بالتكرار المتباعد، بطاقة بطاقة';

  @override
  String toolCardsCount(int count) {
    return '$count بطاقة';
  }

  @override
  String get toolMcqs => 'اختبار';

  @override
  String get toolMcqsPurpose => 'أسئلة اختيار من متعدد كأنك في الامتحان';

  @override
  String toolMcqsCount(int count) {
    return '$count سؤال';
  }

  @override
  String get toolSummary => 'ملخص';

  @override
  String get toolSummaryPurpose => 'الشرح كاملًا في صفحة مرتبة للقراءة';

  @override
  String get toolMindmap => 'خريطة ذهنية';

  @override
  String get toolMindmapPurpose => 'كيف ترتبط المفاهيم ببعضها';

  @override
  String get toolMatch => 'لعبة المطابقة';

  @override
  String get toolMatchPurpose => 'طابق كل سؤال بجوابه قبل ما يخلص الوقت';

  @override
  String get toolPreparing => 'قيد التجهيز';

  @override
  String get toolLocked => 'غير جاهز بعد';

  @override
  String get examFocusHeadline => 'أهم ما يأتي في الامتحان من هذا الكتاب';

  @override
  String examFocusReadyCount(int count) {
    return '$count معلومة مركّزة، مرتبة حسب الأهمية';
  }

  @override
  String get examFocusBusy => 'نحلّل الكتاب ونستخرج المعلومات المهمة…';

  @override
  String get examFocusIdle => 'نستخرج المعلومات التي يتكرر سؤالها ونرتبها لك';

  @override
  String get examFocusOpen => 'افتح Exam Focus';

  @override
  String get examFocusPrepare => 'جهّز Exam Focus';

  @override
  String get examFocusSharedMissing => 'لم يُنشئه صاحب الملف بعد';

  @override
  String get bookSource => 'الملف الأصلي';

  @override
  String bookSourceMeta(int pages, String date) {
    return '$pages صفحة، رُفع $date';
  }

  @override
  String get bookSourceView => 'عرض';

  @override
  String get bookProcessing => 'تفاصيل المعالجة';

  @override
  String get bookProcessingDone => 'مكتملة';

  @override
  String get statVisualDone => 'صفحات مُجهّزة بصريًا';

  @override
  String get statWithVisuals => 'صفحات فيها صور أو مخططات';

  @override
  String get statNeedsReview => 'تحتاج مراجعة';

  @override
  String get statFailed => 'صفحات فشل تحليلها';

  @override
  String coverageLine(int coverage, int done, int total) {
    return 'تغطية المعالجة $coverage% ($done من $total صفحة)';
  }

  @override
  String coverageMissing(String pages) {
    return 'صفحات تحتاج معالجة: $pages';
  }

  @override
  String coverageFailed(String pages) {
    return 'صفحات فشلت: $pages';
  }

  @override
  String get bookLeaveHint =>
      'تقدر تطلع وترجع بعدين من أي جهاز، ما راح يضيع أي تقدّم.';

  @override
  String get stageReading => 'قراءة الصفحات';

  @override
  String get stageChapters => 'تحليل الفصول (الشرح، البطاقات، الأسئلة)';

  @override
  String get stageWaiting => 'بانتظار اختيارك';

  @override
  String get stageVisuals => 'استخراج الصور والمخططات';

  @override
  String get stageCoverage => 'التحقق من اكتمال التغطية';

  @override
  String stageFraction(int done, int total) {
    return '$done/$total';
  }

  @override
  String get bookFailedDefault =>
      'تعذّرت قراءة هذا الكتاب. جرّب إعادة المحاولة أو رفع نسخة أخرى منه.';

  @override
  String get bookRetryExtraction => 'إعادة محاولة الاستخراج';

  @override
  String get bookUploadAnother => 'ارفع كتابًا جديدًا';

  @override
  String bookPartialChapters(int count) {
    return 'اكتمل معظم الكتاب، لكن $count فصل تعذّر تحليله. يمكنك إعادة المحاولة أدناه.';
  }

  @override
  String bookPartialChaptersPages(int chapters, int pages) {
    return 'اكتمل معظم الكتاب، لكن $chapters فصل تعذّر تحليله و$pages صفحة تعذّرت قراءتها. يمكنك إعادة المحاولة أدناه.';
  }

  @override
  String get bookLowConfidence =>
      'اكتشفنا تقسيم الكتاب بشكل تقريبي. يمكنك مراجعة أسماء الفصول وحدود الصفحات.';

  @override
  String pageNumber(int page) {
    return 'صفحة $page';
  }

  @override
  String get pageTextFailedDefault => 'تعذّرت قراءة هذه الصفحة ضوئيًا';

  @override
  String get chapterAnalyzing => 'جارٍ التحليل…';

  @override
  String get chapterFailedDefault => 'تعذر التحليل';

  @override
  String get bookNotFound => 'تعذر العثور على هذا الكتاب';

  @override
  String get uploadLeaveTitle => 'إيقاف الرفع؟';

  @override
  String get uploadLeaveBody =>
      'الملف لم يكتمل رفعه بعد. إذا خرجت الآن يتوقف الرفع وتحتاج تبدأه من جديد.';

  @override
  String get uploadLeaveConfirm => 'إيقاف والخروج';

  @override
  String studyCoverageRead(int read, int total) {
    return 'قُرئت $read/$total صفحة';
  }

  @override
  String studyCoverageAnalyzed(int done, int total) {
    return 'حُلّل $done/$total أجزاء';
  }

  @override
  String studyCoverageChunks(int covered, int required) {
    return 'التغطية $covered/$required مقاطع';
  }

  @override
  String studyCoverageFailedPages(String pages) {
    return 'تعذّرت قراءة الصفحات $pages';
  }

  @override
  String studyCoverageGenFailed(String titles) {
    return 'فشل التوليد لـ: $titles';
  }

  @override
  String get studyKnowledgeTitle => 'نجهّز كل حقائق الملف أولاً';

  @override
  String get studyKnowledgeBodyCards =>
      'البطاقات تُبنى من قاعدة معرفة واحدة تغطي كل صفحة — نفس حقائق Exam Focus.';

  @override
  String get studyKnowledgeBodyMcqs =>
      'الأسئلة تُبنى من قاعدة معرفة واحدة تغطي كل صفحة — نفس حقائق Exam Focus.';

  @override
  String studyKnowledgeUnits(int done, int total) {
    return 'الأجزاء: $done/$total';
  }

  @override
  String get studyGeneratingCards => 'توليد البطاقات من الملف كاملاً';

  @override
  String get studyGeneratingMcqs => 'توليد الأسئلة من الملف كاملاً';

  @override
  String studyGeneratingProgress(int done, int total) {
    return '$done من $total جاهز';
  }

  @override
  String studyGeneratingNow(String title) {
    return 'جاري الآن: $title';
  }

  @override
  String studyGeneratingQueue(int count) {
    return 'في قائمة الانتظار ($count)';
  }

  @override
  String get studyLeaveHint =>
      'التجهيز يكمل على الخادم حتى لو طلعت من التطبيق.';

  @override
  String get studyEmptyOwner => 'جهّز أدوات الدراسة من صفحة الكتاب أولاً.';

  @override
  String get studyRestart => 'ابدأ من جديد';

  @override
  String get studyBack => 'رجوع';

  @override
  String get flashEmpty => 'لا توجد بطاقات لهذا الملف بعد';

  @override
  String get flashEmptyShared => 'لم يولّد صاحب الملف بطاقات بعد.';

  @override
  String get flashTime => 'الوقت';

  @override
  String get flashRemaining => 'متبقي';

  @override
  String get flashLearning => 'قيد التعلم';

  @override
  String get flashMastered => 'متقن';

  @override
  String flashCardOf(int n, int total) {
    return 'البطاقة: $n/$total';
  }

  @override
  String get flashQuestion => 'السؤال';

  @override
  String get flashAnswer => 'الإجابة';

  @override
  String get flashTapToFlip => 'اضغط للقلب';

  @override
  String get flashTapToQuestion => 'اضغط لرؤية السؤال';

  @override
  String get flashSource => 'المصدر';

  @override
  String get flashExplainTitle => 'شرح البطاقة';

  @override
  String get flashTranslate => 'ترجمة';

  @override
  String get flashExplain => 'شرح';

  @override
  String get flashPrev => 'السابق';

  @override
  String get flashNext => 'التالي';

  @override
  String get flashLangToggle => 'تغيير لغة البطاقة';

  @override
  String get flashRateFailed => 'تعذّر حفظ التقييم. تحقق من اتصالك.';

  @override
  String get rateAgain => 'لم أتذكر';

  @override
  String get rateHard => 'صعبة';

  @override
  String get rateGood => 'جيدة';

  @override
  String get rateEasy => 'سهلة';

  @override
  String get flashDone => 'انتهت المراجعة 🎉';

  @override
  String flashDoneBody(int count, String time, int mastered, int learning) {
    return 'راجعت $count بطاقة في $time — متقن $mastered، قيد التعلم $learning.';
  }

  @override
  String get flashReviewHard => 'راجع البطاقات الصعبة';

  @override
  String get labelQuestionBi => 'QUESTION / السؤال';

  @override
  String get labelAnswerBi => 'ANSWER / الإجابة';

  @override
  String get labelTermBi => 'TERM / المصطلح';

  @override
  String get quizEmpty => 'لا يوجد اختبار لهذا الملف بعد';

  @override
  String get quizEmptyShared => 'لم يولّد صاحب الملف أسئلة بعد.';

  @override
  String quizQuestionOf(int n, int total) {
    return 'السؤال $n من $total';
  }

  @override
  String quizPage(int page) {
    return 'صفحة $page';
  }

  @override
  String quizScore(int score) {
    return 'النتيجة: $score';
  }

  @override
  String get quizFlagged => 'هذا السؤال يحتاج مراجعة';

  @override
  String get quizCorrect => 'إجابة صحيحة ✓';

  @override
  String get quizWrong => 'إجابة خاطئة ✗';

  @override
  String get quizSaveFailed => 'تعذر حفظ إجابتك. اختر الإجابة مرة أخرى.';

  @override
  String get quizHint => 'تلميح';

  @override
  String get quizSkip => 'تخطي';

  @override
  String quizResult(int score, int total) {
    return 'النتيجة: $score / $total';
  }

  @override
  String quizAnsweredSome(int answered, int total) {
    return 'جاوبت $answered من $total سؤال.';
  }

  @override
  String get quizAllCorrect => 'ممتاز! كل الإجابات صحيحة 🎉';

  @override
  String get quizReviewWrong => 'راجع الأسئلة الغلط وجرّب مرة ثانية.';

  @override
  String get quizRetryWrong => 'أعد الأسئلة الغلط';

  @override
  String quizDot(int n) {
    return 'السؤال $n';
  }

  @override
  String get summaryTitle => 'الملخص';

  @override
  String get summaryShowAr => 'عرض بالعربي';

  @override
  String get summaryShowEn => 'عرض بالإنجليزي';

  @override
  String get summaryCopyLink => 'نسخ الرابط';

  @override
  String get summaryLinkCopied => 'تم نسخ الرابط';

  @override
  String get summaryCompose => 'تجهيز ملخص منظم';

  @override
  String get summaryComposeBody =>
      'حوّل هذا الجزء إلى ملخص طبي منظم: تعريف، أعراض، تشخيص، علاج، ونقاط خطر.';

  @override
  String get summaryEmpty => 'لا يوجد ملخص جاهز بعد';

  @override
  String get summaryEmptyShared => 'لم يجهّز صاحب الملف الملخص بعد.';

  @override
  String get efSubtitle => 'أهم معلومات الامتحان';

  @override
  String efCardCount(int count) {
    return '$count معلومة مركّزة';
  }

  @override
  String get efPreparing => 'نجهّز Exam Focus…';

  @override
  String get efStartFailed => 'ما قدرنا نبدأ Exam Focus';

  @override
  String get efTryAgain => 'حاول مرة ثانية';

  @override
  String get efUnavailable => 'Exam Focus غير متاح';

  @override
  String get efCannotOpen => 'تعذر فتح هذا الملف.';

  @override
  String get efAnalysisFailed => 'تعذر تحليل الملف';

  @override
  String get efNothingFound => 'لم نجد معلومات امتحانية واضحة 🤔';

  @override
  String get efTryRegenerate => 'جرّب إعادة التوليد.';

  @override
  String get efRegenerate => 'إعادة التوليد';

  @override
  String get efRegenerateConfirm =>
      'إعادة توليد Exam Focus من جديد؟ البطاقات الحالية والمحفوظة رح تنحذف.';

  @override
  String get efSearch => 'بحث في البطاقات';

  @override
  String get efSearchHint => 'ابحث: chemical burns، 15–30 minutes…';

  @override
  String get efClearSearch => 'مسح البحث';

  @override
  String get efAll => 'الكل';

  @override
  String get efSaved => 'راجعها لاحقًا';

  @override
  String get efSave => 'احفظ للمراجعة لاحقًا';

  @override
  String get efUnsave => 'إزالة من المحفوظة';

  @override
  String get efProgress => 'تقدّمك في البطاقات';

  @override
  String get efNoMatch => 'ما في بطاقات تطابق 🔎';

  @override
  String get efNoMatchHint => 'جرّب كلمة ثانية أو اختر «الكل».';

  @override
  String efPartial(String ranges) {
    return '⚠️ تعذر تحليل ص $ranges.';
  }

  @override
  String efCoverage(int covered, int total) {
    return '📊 البطاقات غطّت $covered/$total صفحة محتوى';
  }

  @override
  String efNoTextPages(int count) {
    return '$count صفحة بدون نص مقروء';
  }

  @override
  String get efProgressTitle => '⏳ نحلل ملفك كاملًا…';

  @override
  String get efProgressBody =>
      'نقرأ كل الصفحات من أولها لآخرها ونستخرج المعلومات المهمة للامتحان. تقدر تطلع وترجع، الشغل مستمر على الخادم.';

  @override
  String get efStageAnalyse => 'تحليل كل صفحات الملف';

  @override
  String efStageUnits(int done, int total) {
    return '$done/$total جزء';
  }

  @override
  String get efStageExtract => 'استخراج المعلومات عالية الأهمية';

  @override
  String efStageFacts(int count) {
    return '$count معلومة';
  }

  @override
  String get efStageDedupe => 'إزالة التكرار';

  @override
  String get efStageBuild => 'بناء بطاقات Exam Focus';

  @override
  String get efStageCoverage => 'التحقق من تغطية الملف كاملًا';

  @override
  String efUnitPages(String range) {
    return 'ص $range';
  }

  @override
  String get mindmapIntro =>
      'خريطة دراسية مرتبطة بالملخص، المصطلحات، البطاقات، وأسئلة الاختبار.';

  @override
  String get mindmapChapters => 'الفصول الجاهزة';

  @override
  String get mindmapBranches => 'الأقسام الرئيسية';

  @override
  String get mindmapConcepts => 'المفاهيم المرتبطة';

  @override
  String get mindmapExamPoints => 'نقاط عالية العائد';

  @override
  String get mindmapEmpty => 'لا توجد فصول مكتملة بعد';

  @override
  String get mindmapEmptyHint =>
      'ستظهر الخريطة تلقائيًا بعد اكتمال تحليل الكتاب.';

  @override
  String get mindmapNotBuilt => 'جاهز للبناء';

  @override
  String mindmapChapterMeta(int branches, int points) {
    return '$branches أقسام · $points نقاط مهمة';
  }

  @override
  String get mindmapSharedNotBuilt => 'لم يبنِ صاحب الملف خريطة هذا الفصل بعد.';

  @override
  String get mindmapBuildHint =>
      'اربط الشرح الإنجليزي والعربي بالمصطلحات والبطاقات والأسئلة في خريطة واحدة.';

  @override
  String get mindmapBuildFailed => 'تعذر بناء الخريطة، حاول مرة أخرى.';

  @override
  String get mindmapBuild => 'بناء الخريطة';

  @override
  String get mindmapQueued => 'في قائمة الانتظار…';

  @override
  String get mindmapBuilding => 'جاري البناء…';

  @override
  String get mindmapOpenSummary => 'فتح الملخص';

  @override
  String get mindmapOpenCards => 'فتح البطاقات';

  @override
  String get mindmapKeyPoints => 'High-Yield / أهم النقاط';

  @override
  String get mindmapVisuals => 'Visual anchors / الصور والمخططات';

  @override
  String get mindmapSourceLinked => 'قسم مرتبط بالمصدر';

  @override
  String mindmapPages(String pages) {
    return 'صفحات $pages';
  }

  @override
  String get mindmapConceptsLabel => 'Concepts / المفاهيم';

  @override
  String get mindmapExamLabel => 'Exam focus / نقاط الامتحان';

  @override
  String get mindmapPromptsLabel => 'Recall prompts / أسئلة الاستدعاء';

  @override
  String get mindmapFooter =>
      'الخريطة لا تستبدل الملخص؛ هي تعيد تنظيمه مع البطاقات والأسئلة حتى ترى الصورة الكاملة وتعرف أين تراجع.';

  @override
  String matchSeconds(String seconds) {
    return '$seconds ثانية';
  }

  @override
  String get matchNewRound => 'جولة جديدة';

  @override
  String get matchHint => 'اضغط السؤال ثم جوابه ليختفيا — بأسرع وقت! ⚡';

  @override
  String get matchNeedCards => 'نحتاج بطاقات أولاً 🃏';

  @override
  String get matchNeedCardsHint => 'ولّد بطاقات هذا الملف، ثم ارجع للعب ✨';

  @override
  String get matchMakeCards => 'توليد البطاقات';

  @override
  String matchDone(String seconds) {
    return '$seconds ثانية 🎉';
  }

  @override
  String get matchRecord => 'رقم قياسي جديد! 🏆 أداء رائع 💪';

  @override
  String matchBest(String seconds) {
    return 'أفضل وقت لك: $seconds ثانية — تقدر تكسره! 🔥';
  }

  @override
  String matchMistakes(int count) {
    return 'أخطاء: $count (+ثانية لكل خطأ)';
  }

  @override
  String get matchPlayAgain => 'العب مرة ثانية';

  @override
  String matchBestLine(String seconds) {
    return '🏆 أفضل وقت: $seconds ثانية';
  }

  @override
  String get reviewTitle => 'المراجعة اليومية';

  @override
  String get reviewEmpty => 'ممتاز، ما في بطاقات مستحقة اليوم';

  @override
  String get reviewEmptyHint => 'ارجع بعدين، أو ارفع كتابًا أو ملفًا جديدًا.';

  @override
  String reviewLeft(int count) {
    return 'باقي لك $count بطاقة';
  }

  @override
  String reviewRemaining(int count) {
    return '$count متبقية';
  }

  @override
  String reviewMastered(int count) {
    return '$count أتقنتها';
  }

  @override
  String get reviewViewInBook => 'عرض في الكتاب';

  @override
  String get reviewShowAnswer => 'اظهر الإجابة';

  @override
  String get reviewRelatedTerm => 'المصطلح المرتبط';

  @override
  String get reviewExplain => 'اشرحها ببساطة';

  @override
  String get reviewSimpler => 'بشكل أبسط';

  @override
  String get statsIntro => 'تقدمك بالأرقام — نظرة سريعة على مراجعتك ودقّتك.';

  @override
  String get statsReviewed => 'بطاقات تمت مراجعتها';

  @override
  String get statsReviewedHint => 'إجمالي المراجعات';

  @override
  String get statsAccuracy => 'نسبة الإجابات الصحيحة';

  @override
  String get statsAccuracyHint => 'من الأسئلة اللي جاوبت عليها';

  @override
  String get statsStreak => 'سلسلة الأيام';

  @override
  String get statsStreakHint => 'يوم متواصل';

  @override
  String get statsHours => 'ساعات الدراسة';

  @override
  String get statsHoursHint => 'ساعة تقريبًا';

  @override
  String get weakTitle => 'نقاط الضعف';

  @override
  String get weakRowHint => 'الأسئلة اللي غلطت فيها';

  @override
  String get weakIntro =>
      'أسئلة آخر إجابة لك عليها كانت غلط — جاوب صح عشان تختفي من القائمة.';

  @override
  String get weakChapters => 'أضعف الفصول';

  @override
  String get weakEmpty => 'ما في نقاط ضعف حاليًا';

  @override
  String get weakEmptyHint =>
      'لسه ما جاوبت غلط على أي سؤال، أو جاوبت صح على كل اللي غلطته.';

  @override
  String get todayTitle => 'خطة اليوم';

  @override
  String get todayRowHint => 'المستحق، أقرب امتحان، الأسبوع القادم';

  @override
  String get todayIntro =>
      'ماذا ستدرس اليوم؟ نظرة سريعة على كل موادك في مكان واحد.';

  @override
  String get todayDue => 'المستحق اليوم';

  @override
  String todayDueCount(int count) {
    return '$count بطاقة بانتظار مراجعتك من ملفات الأسئلة وكتبي معًا.';
  }

  @override
  String get todayStartReview => 'ابدأ المراجعة';

  @override
  String get todayNothingDue => 'لا توجد بطاقات مستحقة الآن.';

  @override
  String get todayExam => 'موعد الاختبار القادم';

  @override
  String todayExamLine(String name, String date, int days) {
    return '$name — $date (بعد $days يوم)';
  }

  @override
  String get todayContinue => 'تابع القراءة';

  @override
  String get todayNoBook => 'ارفع كتابك الأول لتبدأ.';

  @override
  String get todayOpenBook => 'افتح الكتاب';

  @override
  String get todayForecast => 'الأسبوع القادم (كتبي)';

  @override
  String get todayNoForecast => 'لا توجد مراجعات مجدولة قريبًا.';

  @override
  String get todayFolders => 'موادك';

  @override
  String todayFolderBooks(int count) {
    return '$count كتاب';
  }

  @override
  String todayFolderExam(String date) {
    return 'امتحان $date';
  }

  @override
  String get bookMoveFolder => 'نقل إلى مجلد';

  @override
  String get bookRemoveShared => 'إزالة من مكتبتي';

  @override
  String get bookRemoveSharedBody =>
      'إزالة هذا الملف من مكتبتك؟ يبقى الأصل عند صاحبه، ويمكنه مشاركته معك من جديد.';

  @override
  String studyKnowledgeLine(String tool, int covered, int total) {
    return '🧠 المعرفة: $tool تغطي $covered/$total حقيقة';
  }

  @override
  String get studyRebuildCards => '✨ أعد بناء البطاقات من قاعدة المعرفة';

  @override
  String get studyRebuildMcqs => '✨ أعد بناء الأسئلة من قاعدة المعرفة';

  @override
  String get studyRebuildTitle => 'إعادة البناء';

  @override
  String get studyRebuildCardsConfirm =>
      'سيتم استبدال البطاقات الحالية ببطاقات مبنية من قاعدة المعرفة (كل حقائق الملف)، وسيضيع تقدّم مراجعة البطاقات القديمة. متابعة؟';

  @override
  String get studyRebuildMcqsConfirm =>
      'سيتم استبدال الأسئلة الحالية بأسئلة تطبيقية مبنية من قاعدة المعرفة (كل حقائق الملف). متابعة؟';

  @override
  String get studyRebuildNotReady =>
      'قاعدة المعرفة غير جاهزة بعد — جرّب لاحقًا.';

  @override
  String studyMatrixTitle(int covered, int total) {
    return '🧭 خريطة التغطية · $covered/$total';
  }

  @override
  String get studyMatrixHint =>
      'كل حقيقة من Exam Focus ← البطاقات 🃏 والأسئلة ❓ المبنية منها ← صفحاتها.';

  @override
  String studyMatrixPages(String pages) {
    return 'ص $pages';
  }

  @override
  String get readerOpening => 'نفتح الملف…';

  @override
  String get readerNoFile => 'تعذر العثور على هذا الملف';

  @override
  String get readerNoFileHint => 'ارجع لصفحة الكتاب وحاول مرة أخرى.';

  @override
  String get readerGoTo => 'الانتقال إلى صفحة';

  @override
  String get readerGo => 'انتقال';

  @override
  String readerPageOf(int page, int count) {
    return 'صفحة $page من $count';
  }

  @override
  String readerPageRange(int count) {
    return 'من 1 إلى $count';
  }

  @override
  String get readerSearch => 'بحث في الملف';

  @override
  String get readerSearchHint => 'كلمة أو عبارة…';

  @override
  String get readerNoMatches => 'لا توجد نتائج.';

  @override
  String get readerAskPage => 'اسأل Niro عن الصفحة';

  @override
  String get readerHighlight => 'ظلّل';

  @override
  String get readerAskSelection => 'اسأل Niro';

  @override
  String get readerToolHighlight => 'تظليل';

  @override
  String get readerToolPen => 'قلم';

  @override
  String get readerToolEraser => 'ممحاة';

  @override
  String get readerSaving => 'جاري الحفظ…';

  @override
  String get readerSaved => 'محفوظ';

  @override
  String get readerSaveFailed => 'تعذر الحفظ';

  @override
  String get readerHintHighlight => 'حدّد نصًا على الصفحة ثم اضغط «ظلّل».';

  @override
  String get readerHintPen => 'ارسم بحرّية فوق الصفحة لتحديد النقاط المهمة.';

  @override
  String get readerHintEraser => 'مرّر على التظليل أو الرسم لمسحه.';

  @override
  String askTitle(int page) {
    return 'اسأل Niro · صفحة $page';
  }

  @override
  String askWholePage(int page) {
    return 'الصفحة $page كاملة — حدّد نصًا قبل الضغط لتسأل عنه وحده.';
  }

  @override
  String get askExplain => 'اشرح ببساطة';

  @override
  String get askExplainPage => 'اشرح الصفحة';

  @override
  String get askArabic => 'اشرح بالعربي';

  @override
  String get askExam => 'سؤال امتحان';

  @override
  String get askSummarize => 'لخّص';

  @override
  String get askSummarizePage => 'لخّص الصفحة';

  @override
  String get askThinking => 'Niro يكتب…';

  @override
  String get askHint => 'اسأل عن هذا النص…';

  @override
  String get askSend => 'إرسال';

  @override
  String get askStop => 'إيقاف';

  @override
  String get bookChatTitle => 'اسأل Niro عن هذا الملف';

  @override
  String get bookChatHello => 'أهلاً، أنا Niro 👋 اسألني أي شيء عن هذا الملف.';

  @override
  String get qfTitle => 'بنوك الأسئلة';

  @override
  String get qfIntro =>
      'أسئلة مستخرجة مباشرة من ملفاتك — بدون توليد بالذكاء الاصطناعي.';

  @override
  String get qfUpload => 'رفع ملف أسئلة';

  @override
  String get qfUploadTitle => 'رفع ملف أسئلة';

  @override
  String get qfEmpty => 'لا توجد ملفات أسئلة بعد';

  @override
  String get qfEmptyHint => 'ارفع ملف أسئلة واختر «ملف أسئلة» عند الرفع.';

  @override
  String qfCount(int count) {
    return '$count سؤال';
  }

  @override
  String get qfStatusExtracting => 'جاري الاستخراج…';

  @override
  String get qfStatusComplete => 'تم الاستخراج';

  @override
  String get qfStatusFailed => 'تعذر الاستخراج';

  @override
  String get qfStatusPending => 'قيد الانتظار';

  @override
  String get qfExtracting =>
      'جاري استخراج الأسئلة من الملف — تقدر تسكّر الصفحة وترجع بعدين.';

  @override
  String get qfFailed => 'تعذر استخراج الأسئلة من هذا الملف.';

  @override
  String get qfRetry => 'إعادة المعالجة';

  @override
  String get qfNoQuestions => 'لم يتم العثور على أسئلة';

  @override
  String qfExtractedCount(int count) {
    return '$count سؤال مستخرج';
  }

  @override
  String qfEnriching(int done, int total) {
    return 'جاري إضافة الصور والشرح ($done/$total)';
  }

  @override
  String get qfKind => 'ملف أسئلة';

  @override
  String get qfKindNote =>
      'سيتم استخراج الأسئلة الموجودة فعليًا في الملف — لن يتم توليد أسئلة جديدة بالذكاء الاصطناعي.';

  @override
  String get qfSubmit => 'استخراج الأسئلة';

  @override
  String qfQuotaLeft(int left, int limit) {
    return 'متبقي اليوم: $left من $limit ملفات أسئلة';
  }

  @override
  String get uploadStepKind => 'نوع الملف';

  @override
  String get questionsLabel => 'السؤال';

  @override
  String questionsPosition(int index, int total) {
    return 'السؤال $index من $total';
  }

  @override
  String questionsTally(int answered, int correct) {
    return 'أجبت $answered · صحيح $correct';
  }

  @override
  String get questionsProgressLabel => 'التقدم في الأسئلة';

  @override
  String questionsCardLabel(int index, int total) {
    return 'سؤال $index من $total';
  }

  @override
  String get questionsPickerTitle => 'انتقل إلى سؤال';

  @override
  String get questionsReveal => 'أظهر الإجابة';

  @override
  String get questionsReset => 'إعادة';

  @override
  String get questionsNoAnswerInFile =>
      'لا توجد إجابة مذكورة لهذا السؤال في الملف.';

  @override
  String get questionsNoAnswer => 'لا توجد إجابة مذكورة لهذا السؤال.';

  @override
  String get questionsAiAnswer =>
      'إجابة مقترحة من الذكاء الاصطناعي — لم تُذكر إجابة في الملف الأصلي.';

  @override
  String get questionsMachineTranslation => 'ترجمة آلية';

  @override
  String get doctorSetsTitle => 'مجموعات الدكاترة';

  @override
  String get qfUploadIntro =>
      'ارفع ملف أسئلة (بنك، امتحان سابق، أسئلة مصوّرة) ونستخرج أسئلته كما هي مع إجاباتها إن وُجدت.';

  @override
  String get qfStepFile => 'الملف';
}
