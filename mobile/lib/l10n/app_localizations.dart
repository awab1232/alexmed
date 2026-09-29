import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
  ];

  /// No description provided for @appName.
  ///
  /// In ar, this message translates to:
  /// **'NiroLearn'**
  String get appName;

  /// No description provided for @tabHome.
  ///
  /// In ar, this message translates to:
  /// **'الرئيسية'**
  String get tabHome;

  /// No description provided for @tabGames.
  ///
  /// In ar, this message translates to:
  /// **'ألعاب'**
  String get tabGames;

  /// No description provided for @tabAdd.
  ///
  /// In ar, this message translates to:
  /// **'إضافة'**
  String get tabAdd;

  /// No description provided for @tabNiro.
  ///
  /// In ar, this message translates to:
  /// **'Niro'**
  String get tabNiro;

  /// No description provided for @tabAccount.
  ///
  /// In ar, this message translates to:
  /// **'حسابي'**
  String get tabAccount;

  /// No description provided for @actionRetry.
  ///
  /// In ar, this message translates to:
  /// **'أعد المحاولة'**
  String get actionRetry;

  /// No description provided for @actionCancel.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء'**
  String get actionCancel;

  /// No description provided for @actionConfirm.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد'**
  String get actionConfirm;

  /// No description provided for @actionClose.
  ///
  /// In ar, this message translates to:
  /// **'إغلاق'**
  String get actionClose;

  /// No description provided for @actionSave.
  ///
  /// In ar, this message translates to:
  /// **'حفظ'**
  String get actionSave;

  /// No description provided for @actionContinue.
  ///
  /// In ar, this message translates to:
  /// **'متابعة'**
  String get actionContinue;

  /// No description provided for @loading.
  ///
  /// In ar, this message translates to:
  /// **'جاري التحميل…'**
  String get loading;

  /// No description provided for @offlineBanner.
  ///
  /// In ar, this message translates to:
  /// **'أنت غير متصل — يظهر آخر ما حُفظ على جهازك.'**
  String get offlineBanner;

  /// No description provided for @emptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد شيء هنا بعد'**
  String get emptyTitle;

  /// No description provided for @errorTitle.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر التحميل'**
  String get errorTitle;

  /// No description provided for @errorNetwork.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الاتصال. تحقق من الإنترنت ثم حاول مرة أخرى.'**
  String get errorNetwork;

  /// No description provided for @errorSessionExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت الجلسة. سجّل الدخول مرة أخرى.'**
  String get errorSessionExpired;

  /// No description provided for @errorForbidden.
  ///
  /// In ar, this message translates to:
  /// **'غير مسموح لك بالوصول إلى هذا المحتوى.'**
  String get errorForbidden;

  /// No description provided for @errorNotFound.
  ///
  /// In ar, this message translates to:
  /// **'غير متاح.'**
  String get errorNotFound;

  /// No description provided for @errorRateLimited.
  ///
  /// In ar, this message translates to:
  /// **'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.'**
  String get errorRateLimited;

  /// No description provided for @errorServer.
  ///
  /// In ar, this message translates to:
  /// **'حدث خطأ في الخادم. حاول مرة أخرى بعد قليل.'**
  String get errorServer;

  /// No description provided for @errorRejected.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تنفيذ الطلب.'**
  String get errorRejected;

  /// No description provided for @underConstruction.
  ///
  /// In ar, this message translates to:
  /// **'قيد البناء — {phase}'**
  String underConstruction(String phase);

  /// No description provided for @welcomeTitle.
  ///
  /// In ar, this message translates to:
  /// **'مرحبًا'**
  String get welcomeTitle;

  /// No description provided for @welcomeHeadline.
  ///
  /// In ar, this message translates to:
  /// **'ذاكر بذكاء مع Niro'**
  String get welcomeHeadline;

  /// No description provided for @welcomeBody.
  ///
  /// In ar, this message translates to:
  /// **'ارفع ملفك، ونحوّله لملخص وبطاقات واختبارات بالعربي.'**
  String get welcomeBody;

  /// No description provided for @welcomeSignIn.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول'**
  String get welcomeSignIn;

  /// No description provided for @welcomeCreateAccount.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء حساب'**
  String get welcomeCreateAccount;

  /// No description provided for @loginTitle.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول'**
  String get loginTitle;

  /// No description provided for @loginSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'مرحبًا بعودتك إلى NiroLearn'**
  String get loginSubtitle;

  /// No description provided for @loginIdentifier.
  ///
  /// In ar, this message translates to:
  /// **'رقم الهاتف أو البريد الإلكتروني'**
  String get loginIdentifier;

  /// No description provided for @loginPassword.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور'**
  String get loginPassword;

  /// No description provided for @loginSubmit.
  ///
  /// In ar, this message translates to:
  /// **'دخول'**
  String get loginSubmit;

  /// No description provided for @loginSubmitting.
  ///
  /// In ar, this message translates to:
  /// **'جاري الدخول...'**
  String get loginSubmitting;

  /// No description provided for @loginNoAccount.
  ///
  /// In ar, this message translates to:
  /// **'ليس لديك حساب؟'**
  String get loginNoAccount;

  /// No description provided for @loginCreateAccount.
  ///
  /// In ar, this message translates to:
  /// **'أنشئ حسابًا'**
  String get loginCreateAccount;

  /// No description provided for @loginFillBoth.
  ///
  /// In ar, this message translates to:
  /// **'أدخل رقم الهاتف (أو البريد) وكلمة المرور.'**
  String get loginFillBoth;

  /// No description provided for @showPassword.
  ///
  /// In ar, this message translates to:
  /// **'إظهار كلمة المرور'**
  String get showPassword;

  /// No description provided for @hidePassword.
  ///
  /// In ar, this message translates to:
  /// **'إخفاء كلمة المرور'**
  String get hidePassword;

  /// No description provided for @sessionEndedNotice.
  ///
  /// In ar, this message translates to:
  /// **'انتهت الجلسة. سجّل الدخول مرة أخرى.'**
  String get sessionEndedNotice;

  /// No description provided for @registerTitle.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء حساب'**
  String get registerTitle;

  /// No description provided for @registerPhoneStep.
  ///
  /// In ar, this message translates to:
  /// **'رقم هاتفك'**
  String get registerPhoneStep;

  /// No description provided for @registerPhoneHint.
  ///
  /// In ar, this message translates to:
  /// **'نرسل لك كودًا برسالة نصية للتأكد من الرقم.'**
  String get registerPhoneHint;

  /// No description provided for @registerCountry.
  ///
  /// In ar, this message translates to:
  /// **'الدولة'**
  String get registerCountry;

  /// No description provided for @registerPhone.
  ///
  /// In ar, this message translates to:
  /// **'رقم الموبايل'**
  String get registerPhone;

  /// No description provided for @registerSendCode.
  ///
  /// In ar, this message translates to:
  /// **'أرسل الكود'**
  String get registerSendCode;

  /// No description provided for @registerInvalidPhone.
  ///
  /// In ar, this message translates to:
  /// **'رقم الهاتف غير صحيح. تأكد من الرقم ومن رمز الدولة.'**
  String get registerInvalidPhone;

  /// No description provided for @registerCodeStep.
  ///
  /// In ar, this message translates to:
  /// **'أدخل الكود'**
  String get registerCodeStep;

  /// No description provided for @registerCodeSentTo.
  ///
  /// In ar, this message translates to:
  /// **'أرسلنا كودًا من 6 أرقام إلى {phone}'**
  String registerCodeSentTo(String phone);

  /// No description provided for @registerCode.
  ///
  /// In ar, this message translates to:
  /// **'الكود'**
  String get registerCode;

  /// No description provided for @registerVerify.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد'**
  String get registerVerify;

  /// No description provided for @registerResend.
  ///
  /// In ar, this message translates to:
  /// **'أعد إرسال الكود'**
  String get registerResend;

  /// No description provided for @registerResendIn.
  ///
  /// In ar, this message translates to:
  /// **'إعادة الإرسال بعد {seconds} ث'**
  String registerResendIn(int seconds);

  /// No description provided for @registerChangePhone.
  ///
  /// In ar, this message translates to:
  /// **'غيّر الرقم'**
  String get registerChangePhone;

  /// No description provided for @registerDetailsStep.
  ///
  /// In ar, this message translates to:
  /// **'بياناتك'**
  String get registerDetailsStep;

  /// No description provided for @registerName.
  ///
  /// In ar, this message translates to:
  /// **'الاسم'**
  String get registerName;

  /// No description provided for @registerNameError.
  ///
  /// In ar, this message translates to:
  /// **'اكتب اسمك (حرفين على الأقل).'**
  String get registerNameError;

  /// No description provided for @registerPasswordError.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور لازم تكون 8 أحرف على الأقل.'**
  String get registerPasswordError;

  /// No description provided for @registerSubmit.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء الحساب'**
  String get registerSubmit;

  /// No description provided for @registerHaveAccount.
  ///
  /// In ar, this message translates to:
  /// **'لديك حساب؟'**
  String get registerHaveAccount;

  /// No description provided for @registerTerms.
  ///
  /// In ar, this message translates to:
  /// **'بإنشاء الحساب توافق على سياسة الاستخدام وسياسة الخصوصية.'**
  String get registerTerms;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
