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
}
