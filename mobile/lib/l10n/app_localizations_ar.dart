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
}
