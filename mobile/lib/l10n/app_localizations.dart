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

  /// No description provided for @authOr.
  ///
  /// In ar, this message translates to:
  /// **'أو'**
  String get authOr;

  /// No description provided for @loginWithGoogle.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول عبر Google'**
  String get loginWithGoogle;

  /// No description provided for @googleSignInFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الدخول بحساب Google. تأكد أن على الجهاز حساب Google ثم حاول مجددًا.'**
  String get googleSignInFailed;

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

  /// No description provided for @greetingNight.
  ///
  /// In ar, this message translates to:
  /// **'سهرة دراسة'**
  String get greetingNight;

  /// No description provided for @greetingMorning.
  ///
  /// In ar, this message translates to:
  /// **'صباح الخير'**
  String get greetingMorning;

  /// No description provided for @greetingEvening.
  ///
  /// In ar, this message translates to:
  /// **'مساء الخير'**
  String get greetingEvening;

  /// No description provided for @greetingWithName.
  ///
  /// In ar, this message translates to:
  /// **'{greeting}، {name}'**
  String greetingWithName(String greeting, String name);

  /// No description provided for @nextDueTitle.
  ///
  /// In ar, this message translates to:
  /// **'{count, plural, =1{بطاقة واحدة جاهزة للمراجعة} other{{count} بطاقة جاهزة للمراجعة}}'**
  String nextDueTitle(int count);

  /// No description provided for @nextDueDetail.
  ///
  /// In ar, this message translates to:
  /// **'حوالي {minutes} دقيقة، والمراجعة في وقتها تثبّت المعلومة.'**
  String nextDueDetail(int minutes);

  /// No description provided for @nextDueAction.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ المراجعة'**
  String get nextDueAction;

  /// No description provided for @nextPreparingTitle.
  ///
  /// In ar, this message translates to:
  /// **'نجهّز «{title}»'**
  String nextPreparingTitle(String title);

  /// No description provided for @nextPreparingDetail.
  ///
  /// In ar, this message translates to:
  /// **'نقرأ الصفحات ونقسّمها لفصول. تقدر تفتحه وتتابع التقدّم.'**
  String get nextPreparingDetail;

  /// No description provided for @nextOpenBook.
  ///
  /// In ar, this message translates to:
  /// **'افتح الكتاب'**
  String get nextOpenBook;

  /// No description provided for @nextContinueTitle.
  ///
  /// In ar, this message translates to:
  /// **'تابع «{title}»'**
  String nextContinueTitle(String title);

  /// No description provided for @nextContinueDetail.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد شيء مستحق للمراجعة الآن. أكمل من حيث توقفت.'**
  String get nextContinueDetail;

  /// No description provided for @nextContinueAction.
  ///
  /// In ar, this message translates to:
  /// **'تابع الدراسة'**
  String get nextContinueAction;

  /// No description provided for @nextFirstTitle.
  ///
  /// In ar, this message translates to:
  /// **'ارفع أول كتاب لك'**
  String get nextFirstTitle;

  /// No description provided for @nextFirstDetail.
  ///
  /// In ar, this message translates to:
  /// **'ملف PDF من مقرّرك يكفي. نحوّله لبطاقات وأسئلة وملخص وخريطة ذهنية.'**
  String get nextFirstDetail;

  /// No description provided for @nextFirstAction.
  ///
  /// In ar, this message translates to:
  /// **'ارفع كتابًا'**
  String get nextFirstAction;

  /// No description provided for @examIn.
  ///
  /// In ar, this message translates to:
  /// **'امتحان {name} {when}'**
  String examIn(String name, String when);

  /// No description provided for @daysToday.
  ///
  /// In ar, this message translates to:
  /// **'اليوم'**
  String get daysToday;

  /// No description provided for @daysTomorrow.
  ///
  /// In ar, this message translates to:
  /// **'غدًا'**
  String get daysTomorrow;

  /// No description provided for @daysTwo.
  ///
  /// In ar, this message translates to:
  /// **'بعد يومين'**
  String get daysTwo;

  /// No description provided for @daysFew.
  ///
  /// In ar, this message translates to:
  /// **'بعد {days} أيام'**
  String daysFew(int days);

  /// No description provided for @daysMany.
  ///
  /// In ar, this message translates to:
  /// **'بعد {days} يومًا'**
  String daysMany(int days);

  /// No description provided for @yourBooks.
  ///
  /// In ar, this message translates to:
  /// **'كتبك'**
  String get yourBooks;

  /// No description provided for @bookReady.
  ///
  /// In ar, this message translates to:
  /// **'جاهز للدراسة'**
  String get bookReady;

  /// No description provided for @bookPartsReady.
  ///
  /// In ar, this message translates to:
  /// **'{done} من {total} أجزاء جاهزة'**
  String bookPartsReady(int done, int total);

  /// No description provided for @bookPreparing.
  ///
  /// In ar, this message translates to:
  /// **'نجهّز أدوات الدراسة…'**
  String get bookPreparing;

  /// No description provided for @bookReading.
  ///
  /// In ar, this message translates to:
  /// **'نقرأ الصفحات…'**
  String get bookReading;

  /// No description provided for @sharedPending.
  ///
  /// In ar, this message translates to:
  /// **'{count, plural, =1{لديك طلب مشاركة جديد} other{لديك {count} طلبات مشاركة جديدة}}'**
  String sharedPending(int count);

  /// No description provided for @sharedPendingDetail.
  ///
  /// In ar, this message translates to:
  /// **'زميلك يريد مشاركة ملف دراسي جاهز معك'**
  String get sharedPendingDetail;

  /// No description provided for @sharedWithMe.
  ///
  /// In ar, this message translates to:
  /// **'مشترك معي'**
  String get sharedWithMe;

  /// No description provided for @sharedWithMeDetail.
  ///
  /// In ar, this message translates to:
  /// **'ملفات شاركها معك زملاؤك'**
  String get sharedWithMeDetail;

  /// No description provided for @sharedFrom.
  ///
  /// In ar, this message translates to:
  /// **'مشترك من {owner}'**
  String sharedFrom(String owner);

  /// No description provided for @sharedColleague.
  ///
  /// In ar, this message translates to:
  /// **'زميل'**
  String get sharedColleague;

  /// No description provided for @myFolders.
  ///
  /// In ar, this message translates to:
  /// **'مجلداتي'**
  String get myFolders;

  /// No description provided for @newFolder.
  ///
  /// In ar, this message translates to:
  /// **'مجلد جديد'**
  String get newFolder;

  /// No description provided for @foldersEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مجلدات بعد. المجلد يجمع كتب مادة واحدة وملفات أسئلتها.'**
  String get foldersEmpty;

  /// No description provided for @createFolder.
  ///
  /// In ar, this message translates to:
  /// **'أنشئ مجلدًا'**
  String get createFolder;

  /// No description provided for @folderBooks.
  ///
  /// In ar, this message translates to:
  /// **'{count, plural, =1{كتاب واحد} other{{count} كتب}}'**
  String folderBooks(int count);

  /// No description provided for @folderDecks.
  ///
  /// In ar, this message translates to:
  /// **'، {count} ملف أسئلة'**
  String folderDecks(int count);

  /// No description provided for @folderUpdated.
  ///
  /// In ar, this message translates to:
  /// **'، آخر تحديث {date}'**
  String folderUpdated(String date);

  /// No description provided for @searchFolders.
  ///
  /// In ar, this message translates to:
  /// **'ابحث عن مجلد...'**
  String get searchFolders;

  /// No description provided for @noMatches.
  ///
  /// In ar, this message translates to:
  /// **'لا نتائج مطابقة'**
  String get noMatches;

  /// No description provided for @noMatchesDetail.
  ///
  /// In ar, this message translates to:
  /// **'جرّب اسمًا آخر للبحث.'**
  String get noMatchesDetail;

  /// No description provided for @folderName.
  ///
  /// In ar, this message translates to:
  /// **'اسم المجلد'**
  String get folderName;

  /// No description provided for @folderNameHint.
  ///
  /// In ar, this message translates to:
  /// **'مثال: تشريح، رياضيات 1'**
  String get folderNameHint;

  /// No description provided for @folderType.
  ///
  /// In ar, this message translates to:
  /// **'نوع المادة'**
  String get folderType;

  /// No description provided for @folderCreate.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء'**
  String get folderCreate;

  /// No description provided for @folderCreateError.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر إنشاء المجلد. تحقق من الاسم وحاول مرة أخرى.'**
  String get folderCreateError;

  /// No description provided for @folderLoadError.
  ///
  /// In ar, this message translates to:
  /// **'تعذر تحميل ملفاتك'**
  String get folderLoadError;

  /// No description provided for @folderEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد ملفات في هذا المجلد بعد'**
  String get folderEmpty;

  /// No description provided for @addFile.
  ///
  /// In ar, this message translates to:
  /// **'إضافة ملف'**
  String get addFile;

  /// No description provided for @folderSummary.
  ///
  /// In ar, this message translates to:
  /// **'{type} · {count} ملف'**
  String folderSummary(String type, int count);

  /// No description provided for @questionFilesSection.
  ///
  /// In ar, this message translates to:
  /// **'ملفات الأسئلة'**
  String get questionFilesSection;

  /// No description provided for @questionFileBadge.
  ///
  /// In ar, this message translates to:
  /// **'ملف أسئلة'**
  String get questionFileBadge;

  /// No description provided for @deckMeta.
  ///
  /// In ar, this message translates to:
  /// **'{cards} بطاقة · {pages} صفحة'**
  String deckMeta(int cards, int pages);

  /// No description provided for @bookMeta.
  ///
  /// In ar, this message translates to:
  /// **'{pages} صفحة'**
  String bookMeta(int pages);

  /// No description provided for @moveTo.
  ///
  /// In ar, this message translates to:
  /// **'نقل إلى مجلد'**
  String get moveTo;

  /// No description provided for @noFolder.
  ///
  /// In ar, this message translates to:
  /// **'بدون مادة'**
  String get noFolder;

  /// No description provided for @moved.
  ///
  /// In ar, this message translates to:
  /// **'تم النقل.'**
  String get moved;

  /// No description provided for @renameFolder.
  ///
  /// In ar, this message translates to:
  /// **'إعادة التسمية'**
  String get renameFolder;

  /// No description provided for @deleteFolder.
  ///
  /// In ar, this message translates to:
  /// **'حذف المجلد'**
  String get deleteFolder;

  /// No description provided for @deleteFolderTitle.
  ///
  /// In ar, this message translates to:
  /// **'حذف المجلد؟'**
  String get deleteFolderTitle;

  /// No description provided for @deleteFolderBody.
  ///
  /// In ar, this message translates to:
  /// **'يُحذف المجلد فقط. الكتب وملفات الأسئلة التي فيه تبقى في حسابك بدون مادة.'**
  String get deleteFolderBody;

  /// No description provided for @folderActions.
  ///
  /// In ar, this message translates to:
  /// **'خيارات المجلد'**
  String get folderActions;

  /// No description provided for @saved.
  ///
  /// In ar, this message translates to:
  /// **'تم الحفظ.'**
  String get saved;

  /// No description provided for @addSheetTitle.
  ///
  /// In ar, this message translates to:
  /// **'ماذا تريد أن تضيف؟'**
  String get addSheetTitle;

  /// No description provided for @addBook.
  ///
  /// In ar, this message translates to:
  /// **'كتاب دراسي'**
  String get addBook;

  /// No description provided for @addBookDetail.
  ///
  /// In ar, this message translates to:
  /// **'فصول، شرح، بطاقات، اختبارات وملخص لكل فصل.'**
  String get addBookDetail;

  /// No description provided for @addQuestionFile.
  ///
  /// In ar, this message translates to:
  /// **'ملف أسئلة'**
  String get addQuestionFile;

  /// No description provided for @addQuestionFileDetail.
  ///
  /// In ar, this message translates to:
  /// **'حوّل ملف أسئلة إلى بطاقات مذاكرة سريعة.'**
  String get addQuestionFileDetail;

  /// No description provided for @addFolderDetail.
  ///
  /// In ar, this message translates to:
  /// **'نظّم ملفاتك حسب المادة.'**
  String get addFolderDetail;

  /// No description provided for @addDoctorCode.
  ///
  /// In ar, this message translates to:
  /// **'كود من دكتورك'**
  String get addDoctorCode;

  /// No description provided for @addDoctorCodeDetail.
  ///
  /// In ar, this message translates to:
  /// **'أضف مجموعة أسئلة محمية بكود الوصول.'**
  String get addDoctorCodeDetail;

  /// No description provided for @accountGroup.
  ///
  /// In ar, this message translates to:
  /// **'الحساب'**
  String get accountGroup;

  /// No description provided for @studyGroup.
  ///
  /// In ar, this message translates to:
  /// **'دراستي'**
  String get studyGroup;

  /// No description provided for @adminGroup.
  ///
  /// In ar, this message translates to:
  /// **'الإدارة'**
  String get adminGroup;

  /// No description provided for @helpGroup.
  ///
  /// In ar, this message translates to:
  /// **'المساعدة'**
  String get helpGroup;

  /// No description provided for @studyProfile.
  ///
  /// In ar, this message translates to:
  /// **'الملف الدراسي'**
  String get studyProfile;

  /// No description provided for @studyProfileEmpty.
  ///
  /// In ar, this message translates to:
  /// **'أضف تخصصك وسنتك'**
  String get studyProfileEmpty;

  /// No description provided for @academicYear.
  ///
  /// In ar, this message translates to:
  /// **'السنة الدراسية'**
  String get academicYear;

  /// No description provided for @academicYearHint.
  ///
  /// In ar, this message translates to:
  /// **'مثال: السنة الثالثة'**
  String get academicYearHint;

  /// No description provided for @specialty.
  ///
  /// In ar, this message translates to:
  /// **'التخصص'**
  String get specialty;

  /// No description provided for @specialtyHint.
  ///
  /// In ar, this message translates to:
  /// **'مثال: طب بشري'**
  String get specialtyHint;

  /// No description provided for @usernameRow.
  ///
  /// In ar, this message translates to:
  /// **'اسم المستخدم للمشاركة'**
  String get usernameRow;

  /// No description provided for @usernameEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لم تختره بعد'**
  String get usernameEmpty;

  /// No description provided for @planRow.
  ///
  /// In ar, this message translates to:
  /// **'الباقة والاستخدام'**
  String get planRow;

  /// No description provided for @questionFilesRow.
  ///
  /// In ar, this message translates to:
  /// **'ملفات الأسئلة'**
  String get questionFilesRow;

  /// No description provided for @statsRow.
  ///
  /// In ar, this message translates to:
  /// **'إحصائياتي'**
  String get statsRow;

  /// No description provided for @doctorDashboard.
  ///
  /// In ar, this message translates to:
  /// **'لوحة الدكتور'**
  String get doctorDashboard;

  /// No description provided for @doctorApply.
  ///
  /// In ar, this message translates to:
  /// **'انضم كدكتور'**
  String get doctorApply;

  /// No description provided for @doctorPending.
  ///
  /// In ar, this message translates to:
  /// **'طلب الدكتور قيد المراجعة'**
  String get doctorPending;

  /// No description provided for @doctorRejected.
  ///
  /// In ar, this message translates to:
  /// **'طلب الدكتور لم يُقبل'**
  String get doctorRejected;

  /// No description provided for @doctorSuspended.
  ///
  /// In ar, this message translates to:
  /// **'صلاحيات الدكتور موقوفة'**
  String get doctorSuspended;

  /// No description provided for @privacyPolicy.
  ///
  /// In ar, this message translates to:
  /// **'سياسة الخصوصية'**
  String get privacyPolicy;

  /// No description provided for @termsOfUse.
  ///
  /// In ar, this message translates to:
  /// **'سياسة الاستخدام'**
  String get termsOfUse;

  /// No description provided for @contactUs.
  ///
  /// In ar, this message translates to:
  /// **'تواصل معنا'**
  String get contactUs;

  /// No description provided for @signOut.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج'**
  String get signOut;

  /// No description provided for @signOutConfirmTitle.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج؟'**
  String get signOutConfirmTitle;

  /// No description provided for @signOutConfirmBody.
  ///
  /// In ar, this message translates to:
  /// **'ستحتاج لتسجيل الدخول مرة أخرى على هذا الجهاز.'**
  String get signOutConfirmBody;

  /// No description provided for @deleteAccount.
  ///
  /// In ar, this message translates to:
  /// **'حذف الحساب'**
  String get deleteAccount;

  /// No description provided for @deleteAccountTitle.
  ///
  /// In ar, this message translates to:
  /// **'حذف الحساب نهائيًا؟'**
  String get deleteAccountTitle;

  /// No description provided for @deleteAccountBody.
  ///
  /// In ar, this message translates to:
  /// **'يُحذف حسابك مع كل ملفاتك وصورها، والملخصات والبطاقات والأسئلة، وتقدّمك ومحادثاتك ومشاركاتك. لا يمكن التراجع عن ذلك.'**
  String get deleteAccountBody;

  /// No description provided for @deleteAccountTypeWord.
  ///
  /// In ar, this message translates to:
  /// **'للتأكيد اكتب كلمة «حذف»'**
  String get deleteAccountTypeWord;

  /// No description provided for @deleteAccountConfirmWord.
  ///
  /// In ar, this message translates to:
  /// **'حذف'**
  String get deleteAccountConfirmWord;

  /// No description provided for @deleteAccountSubmit.
  ///
  /// In ar, this message translates to:
  /// **'حذف نهائي'**
  String get deleteAccountSubmit;

  /// No description provided for @planTitle.
  ///
  /// In ar, this message translates to:
  /// **'باقتك في NiroLearn'**
  String get planTitle;

  /// No description provided for @planFree.
  ///
  /// In ar, this message translates to:
  /// **'أنت تستخدم الباقة المجانية.'**
  String get planFree;

  /// No description provided for @planActiveUntil.
  ///
  /// In ar, this message translates to:
  /// **'فعّالة حتى {date}'**
  String planActiveUntil(String date);

  /// No description provided for @planActive.
  ///
  /// In ar, this message translates to:
  /// **'فعّالة'**
  String get planActive;

  /// No description provided for @usageAssistant.
  ///
  /// In ar, this message translates to:
  /// **'مساعد Niro'**
  String get usageAssistant;

  /// No description provided for @usageQuestionFiles.
  ///
  /// In ar, this message translates to:
  /// **'ملفات الأسئلة'**
  String get usageQuestionFiles;

  /// No description provided for @usageStudyFiles.
  ///
  /// In ar, this message translates to:
  /// **'ملفات الدراسة'**
  String get usageStudyFiles;

  /// No description provided for @usageToday.
  ///
  /// In ar, this message translates to:
  /// **'اليوم'**
  String get usageToday;

  /// No description provided for @usageOf.
  ///
  /// In ar, this message translates to:
  /// **'{used} من {limit}'**
  String usageOf(int used, int limit);

  /// No description provided for @usageUnlimited.
  ///
  /// In ar, this message translates to:
  /// **'غير محدود'**
  String get usageUnlimited;

  /// No description provided for @usageResets.
  ///
  /// In ar, this message translates to:
  /// **'يتجدد غدًا'**
  String get usageResets;

  /// No description provided for @maxFileSize.
  ///
  /// In ar, this message translates to:
  /// **'أقصى حجم للملف: {mb} ميغابايت'**
  String maxFileSize(int mb);

  /// No description provided for @openInBrowserFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر فتح الصفحة.'**
  String get openInBrowserFailed;

  /// No description provided for @mirrorTitle.
  ///
  /// In ar, this message translates to:
  /// **'ملف أسئلة ← بطاقات'**
  String get mirrorTitle;

  /// No description provided for @mirrorIntro.
  ///
  /// In ar, this message translates to:
  /// **'ارفع أسئلة مادتك، ونرتّبها لك بطاقات: السؤال، الجواب، الشرح، والكلمة المفتاحية — بالعربي والإنجليزي.'**
  String get mirrorIntro;

  /// No description provided for @mirrorModePdf.
  ///
  /// In ar, this message translates to:
  /// **'ملف PDF'**
  String get mirrorModePdf;

  /// No description provided for @mirrorModeText.
  ///
  /// In ar, this message translates to:
  /// **'نص أسئلة'**
  String get mirrorModeText;

  /// No description provided for @mirrorStepFile.
  ///
  /// In ar, this message translates to:
  /// **'الملف'**
  String get mirrorStepFile;

  /// No description provided for @mirrorStepText.
  ///
  /// In ar, this message translates to:
  /// **'الأسئلة'**
  String get mirrorStepText;

  /// No description provided for @mirrorStepDepth.
  ///
  /// In ar, this message translates to:
  /// **'مستوى الشرح'**
  String get mirrorStepDepth;

  /// No description provided for @mirrorStepFolder.
  ///
  /// In ar, this message translates to:
  /// **'المجلد'**
  String get mirrorStepFolder;

  /// No description provided for @mirrorPickFile.
  ///
  /// In ar, this message translates to:
  /// **'اختر ملف PDF'**
  String get mirrorPickFile;

  /// No description provided for @mirrorPickHint.
  ///
  /// In ar, this message translates to:
  /// **'يدعم الملفات الكبيرة وPDF المصوّر (OCR).'**
  String get mirrorPickHint;

  /// No description provided for @mirrorFileReady.
  ///
  /// In ar, this message translates to:
  /// **'{size} · جاهز للتحليل'**
  String mirrorFileReady(String size);

  /// No description provided for @mirrorChangeFile.
  ///
  /// In ar, this message translates to:
  /// **'تغيير'**
  String get mirrorChangeFile;

  /// No description provided for @mirrorMaxSize.
  ///
  /// In ar, this message translates to:
  /// **'الحد الأقصى في باقتك {mb} ميغابايت'**
  String mirrorMaxSize(int mb);

  /// No description provided for @depthQuick.
  ///
  /// In ar, this message translates to:
  /// **'سريع'**
  String get depthQuick;

  /// No description provided for @depthQuickCaption.
  ///
  /// In ar, this message translates to:
  /// **'مراجعة خاطفة'**
  String get depthQuickCaption;

  /// No description provided for @depthBalanced.
  ///
  /// In ar, this message translates to:
  /// **'متوازن'**
  String get depthBalanced;

  /// No description provided for @depthBalancedCaption.
  ///
  /// In ar, this message translates to:
  /// **'الأفضل للامتحان'**
  String get depthBalancedCaption;

  /// No description provided for @depthDetailed.
  ///
  /// In ar, this message translates to:
  /// **'مفصّل'**
  String get depthDetailed;

  /// No description provided for @depthDetailedCaption.
  ///
  /// In ar, this message translates to:
  /// **'شرح أعمق'**
  String get depthDetailedCaption;

  /// No description provided for @depthRecommended.
  ///
  /// In ar, this message translates to:
  /// **'موصى به'**
  String get depthRecommended;

  /// No description provided for @mirrorChooseFolder.
  ///
  /// In ar, this message translates to:
  /// **'اختر مجلدًا'**
  String get mirrorChooseFolder;

  /// No description provided for @mirrorNoFolders.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مجلدات بعد — أنشئ واحدًا.'**
  String get mirrorNoFolders;

  /// No description provided for @mirrorTextHint.
  ///
  /// In ar, this message translates to:
  /// **'الصق الأسئلة هنا، مع خياراتها وإجاباتها إن وُجدت…'**
  String get mirrorTextHint;

  /// No description provided for @mirrorTextCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} حرف'**
  String mirrorTextCount(int count);

  /// No description provided for @mirrorTextTooShort.
  ///
  /// In ar, this message translates to:
  /// **'الصق نص الأسئلة أولًا (نص قصير جدًا).'**
  String get mirrorTextTooShort;

  /// No description provided for @mirrorTextTooLong.
  ///
  /// In ar, this message translates to:
  /// **'النص أطول من 60,000 حرف. قسّمه على دفعتين وأضف الثانية لنفس الملف.'**
  String get mirrorTextTooLong;

  /// No description provided for @mirrorTextDestination.
  ///
  /// In ar, this message translates to:
  /// **'أين تُضاف البطاقات؟'**
  String get mirrorTextDestination;

  /// No description provided for @mirrorTextNewFile.
  ///
  /// In ar, this message translates to:
  /// **'ملف جديد'**
  String get mirrorTextNewFile;

  /// No description provided for @mirrorTextAppend.
  ///
  /// In ar, this message translates to:
  /// **'إضافة لملف موجود'**
  String get mirrorTextAppend;

  /// No description provided for @mirrorTextTitle.
  ///
  /// In ar, this message translates to:
  /// **'اسم الملف (اختياري)'**
  String get mirrorTextTitle;

  /// No description provided for @mirrorTextTitleHint.
  ///
  /// In ar, this message translates to:
  /// **'مثال: أسئلة الفصل الثالث'**
  String get mirrorTextTitleHint;

  /// No description provided for @mirrorChooseDeck.
  ///
  /// In ar, this message translates to:
  /// **'اختر الملف'**
  String get mirrorChooseDeck;

  /// No description provided for @mirrorSubmit.
  ///
  /// In ar, this message translates to:
  /// **'حوّل إلى بطاقات'**
  String get mirrorSubmit;

  /// No description provided for @mirrorUploading.
  ///
  /// In ar, this message translates to:
  /// **'نرفع الملف… {percent}%'**
  String mirrorUploading(int percent);

  /// No description provided for @mirrorStarting.
  ///
  /// In ar, this message translates to:
  /// **'نجهّز الملف للتوليد…'**
  String get mirrorStarting;

  /// No description provided for @mirrorCancelUpload.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء الرفع'**
  String get mirrorCancelUpload;

  /// No description provided for @mirrorDisclaimer.
  ///
  /// In ar, this message translates to:
  /// **'أداة مساعدة للمذاكرة وليست بديلًا عن مرجع المادة. راجع البطاقات المعلّمة للتدقيق.'**
  String get mirrorDisclaimer;

  /// No description provided for @mirrorJobReading.
  ///
  /// In ar, this message translates to:
  /// **'نقرأ الملف ونجهّزه…'**
  String get mirrorJobReading;

  /// No description provided for @mirrorJobReadingHint.
  ///
  /// In ar, this message translates to:
  /// **'قد يستغرق هذا وقتًا أطول للملفات الممسوحة ضوئيًا. تقدر تطلع وترجع لاحقًا دون فقدان التقدم.'**
  String get mirrorJobReadingHint;

  /// No description provided for @mirrorJobGenerating.
  ///
  /// In ar, this message translates to:
  /// **'نجهّز بطاقاتك'**
  String get mirrorJobGenerating;

  /// No description provided for @mirrorJobProgress.
  ///
  /// In ar, this message translates to:
  /// **'تم {done} من {total} جزءًا'**
  String mirrorJobProgress(int done, int total);

  /// No description provided for @mirrorJobMeta.
  ///
  /// In ar, this message translates to:
  /// **'{pages} صفحة · {batches} جزء'**
  String mirrorJobMeta(int pages, int batches);

  /// No description provided for @mirrorStartStudying.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ المذاكرة'**
  String get mirrorStartStudying;

  /// No description provided for @mirrorStartEarly.
  ///
  /// In ar, this message translates to:
  /// **'أول البطاقات جاهزة — تقدر تبدأ الآن والباقي يوصل تلقائيًا.'**
  String get mirrorStartEarly;

  /// No description provided for @mirrorJobComplete.
  ///
  /// In ar, this message translates to:
  /// **'اكتمل التوليد.'**
  String get mirrorJobComplete;

  /// No description provided for @mirrorJobFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّرت قراءة هذا الملف. جرّب رفع نسخة أخرى منه.'**
  String get mirrorJobFailed;

  /// No description provided for @mirrorRetryPages.
  ///
  /// In ar, this message translates to:
  /// **'إعادة محاولة الصفحات الفاشلة'**
  String get mirrorRetryPages;

  /// No description provided for @mirrorPartial.
  ///
  /// In ar, this message translates to:
  /// **'اكتمل معظم الملف، لكن {count} جزءًا تعذّر توليده.'**
  String mirrorPartial(int count);

  /// No description provided for @mirrorBatchPages.
  ///
  /// In ar, this message translates to:
  /// **'صفحة {range}'**
  String mirrorBatchPages(String range);

  /// No description provided for @mirrorBatchFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر التوليد'**
  String get mirrorBatchFailed;

  /// No description provided for @mirrorUploadNew.
  ///
  /// In ar, this message translates to:
  /// **'ارفع ملفًا جديدًا'**
  String get mirrorUploadNew;

  /// No description provided for @deckCardOf.
  ///
  /// In ar, this message translates to:
  /// **'بطاقة {index} من {total}'**
  String deckCardOf(int index, int total);

  /// No description provided for @deckAll.
  ///
  /// In ar, this message translates to:
  /// **'الكل'**
  String get deckAll;

  /// No description provided for @deckNeedsReview.
  ///
  /// In ar, this message translates to:
  /// **'تحتاج مراجعة'**
  String get deckNeedsReview;

  /// No description provided for @deckSearch.
  ///
  /// In ar, this message translates to:
  /// **'ابحث في السؤال أو الكلمة المفتاحية…'**
  String get deckSearch;

  /// No description provided for @deckEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد بطاقات هنا'**
  String get deckEmpty;

  /// No description provided for @deckEmptyHint.
  ///
  /// In ar, this message translates to:
  /// **'جرّب إزالة البحث أو الفلتر.'**
  String get deckEmptyHint;

  /// No description provided for @deckWaiting.
  ///
  /// In ar, this message translates to:
  /// **'نجهّز أول البطاقات…'**
  String get deckWaiting;

  /// No description provided for @deckLive.
  ///
  /// In ar, this message translates to:
  /// **'جاري تجهيز المزيد — {count} بطاقة جاهزة حتى الآن.'**
  String deckLive(int count);

  /// No description provided for @deckAllReady.
  ///
  /// In ar, this message translates to:
  /// **'اكتملت كل البطاقات.'**
  String get deckAllReady;

  /// No description provided for @deckFailedParts.
  ///
  /// In ar, this message translates to:
  /// **'{count, plural, =1{تعذر توليد جزء واحد من الملف.} other{تعذر توليد {count} أجزاء من الملف.}}'**
  String deckFailedParts(int count);

  /// No description provided for @deckDetails.
  ///
  /// In ar, this message translates to:
  /// **'التفاصيل'**
  String get deckDetails;

  /// No description provided for @deckPrevious.
  ///
  /// In ar, this message translates to:
  /// **'السابقة'**
  String get deckPrevious;

  /// No description provided for @deckNext.
  ///
  /// In ar, this message translates to:
  /// **'التالية'**
  String get deckNext;

  /// No description provided for @deckAddQuestions.
  ///
  /// In ar, this message translates to:
  /// **'إضافة أسئلة'**
  String get deckAddQuestions;

  /// No description provided for @deckDelete.
  ///
  /// In ar, this message translates to:
  /// **'حذف الملف'**
  String get deckDelete;

  /// No description provided for @deckDeleteTitle.
  ///
  /// In ar, this message translates to:
  /// **'حذف ملف الأسئلة؟'**
  String get deckDeleteTitle;

  /// No description provided for @deckDeleteBody.
  ///
  /// In ar, this message translates to:
  /// **'تُحذف كل بطاقات هذا الملف نهائيًا.'**
  String get deckDeleteBody;

  /// No description provided for @deckMore.
  ///
  /// In ar, this message translates to:
  /// **'خيارات الملف'**
  String get deckMore;

  /// No description provided for @cardPage.
  ///
  /// In ar, this message translates to:
  /// **'صفحة {page}'**
  String cardPage(int page);

  /// No description provided for @cardClear.
  ///
  /// In ar, this message translates to:
  /// **'واضحة'**
  String get cardClear;

  /// No description provided for @cardConfidence.
  ///
  /// In ar, this message translates to:
  /// **'ثقة {level}'**
  String cardConfidence(String level);

  /// No description provided for @confidenceHigh.
  ///
  /// In ar, this message translates to:
  /// **'عالية'**
  String get confidenceHigh;

  /// No description provided for @confidenceMedium.
  ///
  /// In ar, this message translates to:
  /// **'متوسطة'**
  String get confidenceMedium;

  /// No description provided for @confidenceLow.
  ///
  /// In ar, this message translates to:
  /// **'منخفضة'**
  String get confidenceLow;

  /// No description provided for @cardReveal.
  ///
  /// In ar, this message translates to:
  /// **'اظهر الإجابة والشرح'**
  String get cardReveal;

  /// No description provided for @cardCorrect.
  ///
  /// In ar, this message translates to:
  /// **'إجابة صحيحة'**
  String get cardCorrect;

  /// No description provided for @cardWrong.
  ///
  /// In ar, this message translates to:
  /// **'إجابة خاطئة'**
  String get cardWrong;

  /// No description provided for @cardAnswer.
  ///
  /// In ar, this message translates to:
  /// **'الإجابة'**
  String get cardAnswer;

  /// No description provided for @cardExplanation.
  ///
  /// In ar, this message translates to:
  /// **'الشرح'**
  String get cardExplanation;

  /// No description provided for @cardKeyIdea.
  ///
  /// In ar, this message translates to:
  /// **'الفكرة الأساسية'**
  String get cardKeyIdea;

  /// No description provided for @cardKeyword.
  ///
  /// In ar, this message translates to:
  /// **'الكلمة المفتاحية'**
  String get cardKeyword;

  /// No description provided for @cardShowTranslation.
  ///
  /// In ar, this message translates to:
  /// **'عرض الترجمة'**
  String get cardShowTranslation;

  /// No description provided for @cardHideTranslation.
  ///
  /// In ar, this message translates to:
  /// **'إخفاء الترجمة'**
  String get cardHideTranslation;

  /// No description provided for @cardTryAgain.
  ///
  /// In ar, this message translates to:
  /// **'إعادة'**
  String get cardTryAgain;

  /// No description provided for @cardImageFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل الصورة'**
  String get cardImageFailed;

  /// No description provided for @questionFilesTitle.
  ///
  /// In ar, this message translates to:
  /// **'ملفات الأسئلة'**
  String get questionFilesTitle;

  /// No description provided for @questionFilesEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد ملفات أسئلة بعد'**
  String get questionFilesEmpty;

  /// No description provided for @questionFilesEmptyHint.
  ///
  /// In ar, this message translates to:
  /// **'ارفع ملفك الأول وسيظهر هنا بعد التوليد.'**
  String get questionFilesEmptyHint;

  /// No description provided for @questionFilesNew.
  ///
  /// In ar, this message translates to:
  /// **'ملف جديد'**
  String get questionFilesNew;

  /// No description provided for @bookUploadTitle.
  ///
  /// In ar, this message translates to:
  /// **'رفع كتاب دراسي'**
  String get bookUploadTitle;

  /// No description provided for @bookUploadIntro.
  ///
  /// In ar, this message translates to:
  /// **'ارفع كتابك مهما كان حجمه، ونقسّمه لك لفصول صغيرة ونحلّل كل فصل على حدة.'**
  String get bookUploadIntro;

  /// No description provided for @bookStepFile.
  ///
  /// In ar, this message translates to:
  /// **'الكتاب'**
  String get bookStepFile;

  /// No description provided for @bookStepProfile.
  ///
  /// In ar, this message translates to:
  /// **'نوع المادة'**
  String get bookStepProfile;

  /// No description provided for @bookProfileHint.
  ///
  /// In ar, this message translates to:
  /// **'يوجّه التحليل لطريقة مادتك.'**
  String get bookProfileHint;

  /// No description provided for @bookSubmit.
  ///
  /// In ar, this message translates to:
  /// **'حوّل إلى فصول'**
  String get bookSubmit;

  /// No description provided for @bookStarting.
  ///
  /// In ar, this message translates to:
  /// **'جاري تجهيز الكتاب…'**
  String get bookStarting;

  /// No description provided for @bookKeepOpen.
  ///
  /// In ar, this message translates to:
  /// **'أبقِ التطبيق مفتوحًا حتى يكتمل الرفع — بعده يكمل التجهيز على الخادم.'**
  String get bookKeepOpen;

  /// No description provided for @bookQuotaLeft.
  ///
  /// In ar, this message translates to:
  /// **'متبقي اليوم {remaining} من {limit} ملفات دراسة'**
  String bookQuotaLeft(int remaining, int limit);

  /// No description provided for @bookDuplicateTitle.
  ///
  /// In ar, this message translates to:
  /// **'عندك ملف بنفس الاسم'**
  String get bookDuplicateTitle;

  /// No description provided for @bookDuplicateBody.
  ///
  /// In ar, this message translates to:
  /// **'«{title}» موجود في مكتبتك. افتحه بدل رفعه مرة ثانية، أو ارفع هذا كنسخة جديدة.'**
  String bookDuplicateBody(String title);

  /// No description provided for @bookDuplicateOpen.
  ///
  /// In ar, this message translates to:
  /// **'افتح الموجود'**
  String get bookDuplicateOpen;

  /// No description provided for @bookMetaParts.
  ///
  /// In ar, this message translates to:
  /// **'{count, plural, =1{جزء واحد} other{{count} أجزاء}}'**
  String bookMetaParts(int count);

  /// No description provided for @bookStudyTitle.
  ///
  /// In ar, this message translates to:
  /// **'ادرس هذا الكتاب'**
  String get bookStudyTitle;

  /// No description provided for @bookToolsAfterReading.
  ///
  /// In ar, this message translates to:
  /// **'أدوات الدراسة تظهر هنا بعد ما نخلّص قراءة صفحات الملف.'**
  String get bookToolsAfterReading;

  /// No description provided for @bookGenerateBody.
  ///
  /// In ar, this message translates to:
  /// **'جهّز البطاقات والأسئلة والملخص والخريطة الذهنية لهذا الكتاب بضغطة واحدة. تقدر تطلع من التطبيق، التجهيز يكمل لحاله.'**
  String get bookGenerateBody;

  /// No description provided for @bookGenerate.
  ///
  /// In ar, this message translates to:
  /// **'جهّز أدوات الدراسة'**
  String get bookGenerate;

  /// No description provided for @bookGenerateError.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر بدء التجهيز. تحقق من اتصالك وحاول مرة أخرى.'**
  String get bookGenerateError;

  /// No description provided for @bookSharedNotStarted.
  ///
  /// In ar, this message translates to:
  /// **'لم يبدأ صاحب الملف التجهيز بعد.'**
  String get bookSharedNotStarted;

  /// No description provided for @bookSharedFrom.
  ///
  /// In ar, this message translates to:
  /// **'مشترك من {name}'**
  String bookSharedFrom(String name);

  /// No description provided for @toolCards.
  ///
  /// In ar, this message translates to:
  /// **'بطاقات'**
  String get toolCards;

  /// No description provided for @toolCardsPurpose.
  ///
  /// In ar, this message translates to:
  /// **'احفظ بالتكرار المتباعد، بطاقة بطاقة'**
  String get toolCardsPurpose;

  /// No description provided for @toolCardsCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} بطاقة'**
  String toolCardsCount(int count);

  /// No description provided for @toolMcqs.
  ///
  /// In ar, this message translates to:
  /// **'اختبار'**
  String get toolMcqs;

  /// No description provided for @toolMcqsPurpose.
  ///
  /// In ar, this message translates to:
  /// **'أسئلة اختيار من متعدد كأنك في الامتحان'**
  String get toolMcqsPurpose;

  /// No description provided for @toolMcqsCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} سؤال'**
  String toolMcqsCount(int count);

  /// No description provided for @toolSummary.
  ///
  /// In ar, this message translates to:
  /// **'ملخص'**
  String get toolSummary;

  /// No description provided for @toolSummaryPurpose.
  ///
  /// In ar, this message translates to:
  /// **'الشرح كاملًا في صفحة مرتبة للقراءة'**
  String get toolSummaryPurpose;

  /// No description provided for @toolMindmap.
  ///
  /// In ar, this message translates to:
  /// **'خريطة ذهنية'**
  String get toolMindmap;

  /// No description provided for @toolMindmapPurpose.
  ///
  /// In ar, this message translates to:
  /// **'كيف ترتبط المفاهيم ببعضها'**
  String get toolMindmapPurpose;

  /// No description provided for @toolMatch.
  ///
  /// In ar, this message translates to:
  /// **'لعبة المطابقة'**
  String get toolMatch;

  /// No description provided for @toolMatchPurpose.
  ///
  /// In ar, this message translates to:
  /// **'طابق كل سؤال بجوابه قبل ما يخلص الوقت'**
  String get toolMatchPurpose;

  /// No description provided for @toolPreparing.
  ///
  /// In ar, this message translates to:
  /// **'قيد التجهيز'**
  String get toolPreparing;

  /// No description provided for @toolLocked.
  ///
  /// In ar, this message translates to:
  /// **'غير جاهز بعد'**
  String get toolLocked;

  /// No description provided for @examFocusHeadline.
  ///
  /// In ar, this message translates to:
  /// **'أهم ما يأتي في الامتحان من هذا الكتاب'**
  String get examFocusHeadline;

  /// No description provided for @examFocusReadyCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} معلومة مركّزة، مرتبة حسب الأهمية'**
  String examFocusReadyCount(int count);

  /// No description provided for @examFocusBusy.
  ///
  /// In ar, this message translates to:
  /// **'نحلّل الكتاب ونستخرج المعلومات المهمة…'**
  String get examFocusBusy;

  /// No description provided for @examFocusIdle.
  ///
  /// In ar, this message translates to:
  /// **'نستخرج المعلومات التي يتكرر سؤالها ونرتبها لك'**
  String get examFocusIdle;

  /// No description provided for @examFocusOpen.
  ///
  /// In ar, this message translates to:
  /// **'افتح Exam Focus'**
  String get examFocusOpen;

  /// No description provided for @examFocusPrepare.
  ///
  /// In ar, this message translates to:
  /// **'جهّز Exam Focus'**
  String get examFocusPrepare;

  /// No description provided for @examFocusSharedMissing.
  ///
  /// In ar, this message translates to:
  /// **'لم يُنشئه صاحب الملف بعد'**
  String get examFocusSharedMissing;

  /// No description provided for @bookSource.
  ///
  /// In ar, this message translates to:
  /// **'الملف الأصلي'**
  String get bookSource;

  /// No description provided for @bookSourceMeta.
  ///
  /// In ar, this message translates to:
  /// **'{pages} صفحة، رُفع {date}'**
  String bookSourceMeta(int pages, String date);

  /// No description provided for @bookSourceView.
  ///
  /// In ar, this message translates to:
  /// **'عرض'**
  String get bookSourceView;

  /// No description provided for @bookProcessing.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل المعالجة'**
  String get bookProcessing;

  /// No description provided for @bookProcessingDone.
  ///
  /// In ar, this message translates to:
  /// **'مكتملة'**
  String get bookProcessingDone;

  /// No description provided for @statVisualDone.
  ///
  /// In ar, this message translates to:
  /// **'صفحات مُجهّزة بصريًا'**
  String get statVisualDone;

  /// No description provided for @statWithVisuals.
  ///
  /// In ar, this message translates to:
  /// **'صفحات فيها صور أو مخططات'**
  String get statWithVisuals;

  /// No description provided for @statNeedsReview.
  ///
  /// In ar, this message translates to:
  /// **'تحتاج مراجعة'**
  String get statNeedsReview;

  /// No description provided for @statFailed.
  ///
  /// In ar, this message translates to:
  /// **'صفحات فشل تحليلها'**
  String get statFailed;

  /// No description provided for @coverageLine.
  ///
  /// In ar, this message translates to:
  /// **'تغطية المعالجة {coverage}% ({done} من {total} صفحة)'**
  String coverageLine(int coverage, int done, int total);

  /// No description provided for @coverageMissing.
  ///
  /// In ar, this message translates to:
  /// **'صفحات تحتاج معالجة: {pages}'**
  String coverageMissing(String pages);

  /// No description provided for @coverageFailed.
  ///
  /// In ar, this message translates to:
  /// **'صفحات فشلت: {pages}'**
  String coverageFailed(String pages);

  /// No description provided for @bookLeaveHint.
  ///
  /// In ar, this message translates to:
  /// **'تقدر تطلع وترجع بعدين من أي جهاز، ما راح يضيع أي تقدّم.'**
  String get bookLeaveHint;

  /// No description provided for @stageReading.
  ///
  /// In ar, this message translates to:
  /// **'قراءة الصفحات'**
  String get stageReading;

  /// No description provided for @stageChapters.
  ///
  /// In ar, this message translates to:
  /// **'تحليل الفصول (الشرح، البطاقات، الأسئلة)'**
  String get stageChapters;

  /// No description provided for @stageWaiting.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار اختيارك'**
  String get stageWaiting;

  /// No description provided for @stageVisuals.
  ///
  /// In ar, this message translates to:
  /// **'استخراج الصور والمخططات'**
  String get stageVisuals;

  /// No description provided for @stageCoverage.
  ///
  /// In ar, this message translates to:
  /// **'التحقق من اكتمال التغطية'**
  String get stageCoverage;

  /// No description provided for @stageFraction.
  ///
  /// In ar, this message translates to:
  /// **'{done}/{total}'**
  String stageFraction(int done, int total);

  /// No description provided for @bookFailedDefault.
  ///
  /// In ar, this message translates to:
  /// **'تعذّرت قراءة هذا الكتاب. جرّب إعادة المحاولة أو رفع نسخة أخرى منه.'**
  String get bookFailedDefault;

  /// No description provided for @bookRetryExtraction.
  ///
  /// In ar, this message translates to:
  /// **'إعادة محاولة الاستخراج'**
  String get bookRetryExtraction;

  /// No description provided for @bookUploadAnother.
  ///
  /// In ar, this message translates to:
  /// **'ارفع كتابًا جديدًا'**
  String get bookUploadAnother;

  /// No description provided for @bookPartialChapters.
  ///
  /// In ar, this message translates to:
  /// **'اكتمل معظم الكتاب، لكن {count} فصل تعذّر تحليله. يمكنك إعادة المحاولة أدناه.'**
  String bookPartialChapters(int count);

  /// No description provided for @bookPartialChaptersPages.
  ///
  /// In ar, this message translates to:
  /// **'اكتمل معظم الكتاب، لكن {chapters} فصل تعذّر تحليله و{pages} صفحة تعذّرت قراءتها. يمكنك إعادة المحاولة أدناه.'**
  String bookPartialChaptersPages(int chapters, int pages);

  /// No description provided for @bookLowConfidence.
  ///
  /// In ar, this message translates to:
  /// **'اكتشفنا تقسيم الكتاب بشكل تقريبي. يمكنك مراجعة أسماء الفصول وحدود الصفحات.'**
  String get bookLowConfidence;

  /// No description provided for @pageNumber.
  ///
  /// In ar, this message translates to:
  /// **'صفحة {page}'**
  String pageNumber(int page);

  /// No description provided for @pageTextFailedDefault.
  ///
  /// In ar, this message translates to:
  /// **'تعذّرت قراءة هذه الصفحة ضوئيًا'**
  String get pageTextFailedDefault;

  /// No description provided for @chapterAnalyzing.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ التحليل…'**
  String get chapterAnalyzing;

  /// No description provided for @chapterFailedDefault.
  ///
  /// In ar, this message translates to:
  /// **'تعذر التحليل'**
  String get chapterFailedDefault;

  /// No description provided for @bookNotFound.
  ///
  /// In ar, this message translates to:
  /// **'تعذر العثور على هذا الكتاب'**
  String get bookNotFound;

  /// No description provided for @uploadLeaveTitle.
  ///
  /// In ar, this message translates to:
  /// **'إيقاف الرفع؟'**
  String get uploadLeaveTitle;

  /// No description provided for @uploadLeaveBody.
  ///
  /// In ar, this message translates to:
  /// **'الملف لم يكتمل رفعه بعد. إذا خرجت الآن يتوقف الرفع وتحتاج تبدأه من جديد.'**
  String get uploadLeaveBody;

  /// No description provided for @uploadLeaveConfirm.
  ///
  /// In ar, this message translates to:
  /// **'إيقاف والخروج'**
  String get uploadLeaveConfirm;

  /// No description provided for @studyCoverageRead.
  ///
  /// In ar, this message translates to:
  /// **'قُرئت {read}/{total} صفحة'**
  String studyCoverageRead(int read, int total);

  /// No description provided for @studyCoverageAnalyzed.
  ///
  /// In ar, this message translates to:
  /// **'حُلّل {done}/{total} أجزاء'**
  String studyCoverageAnalyzed(int done, int total);

  /// No description provided for @studyCoverageChunks.
  ///
  /// In ar, this message translates to:
  /// **'التغطية {covered}/{required} مقاطع'**
  String studyCoverageChunks(int covered, int required);

  /// No description provided for @studyCoverageFailedPages.
  ///
  /// In ar, this message translates to:
  /// **'تعذّرت قراءة الصفحات {pages}'**
  String studyCoverageFailedPages(String pages);

  /// No description provided for @studyCoverageGenFailed.
  ///
  /// In ar, this message translates to:
  /// **'فشل التوليد لـ: {titles}'**
  String studyCoverageGenFailed(String titles);

  /// No description provided for @studyKnowledgeTitle.
  ///
  /// In ar, this message translates to:
  /// **'نجهّز كل حقائق الملف أولاً'**
  String get studyKnowledgeTitle;

  /// No description provided for @studyKnowledgeBodyCards.
  ///
  /// In ar, this message translates to:
  /// **'البطاقات تُبنى من قاعدة معرفة واحدة تغطي كل صفحة — نفس حقائق Exam Focus.'**
  String get studyKnowledgeBodyCards;

  /// No description provided for @studyKnowledgeBodyMcqs.
  ///
  /// In ar, this message translates to:
  /// **'الأسئلة تُبنى من قاعدة معرفة واحدة تغطي كل صفحة — نفس حقائق Exam Focus.'**
  String get studyKnowledgeBodyMcqs;

  /// No description provided for @studyKnowledgeUnits.
  ///
  /// In ar, this message translates to:
  /// **'الأجزاء: {done}/{total}'**
  String studyKnowledgeUnits(int done, int total);

  /// No description provided for @studyGeneratingCards.
  ///
  /// In ar, this message translates to:
  /// **'توليد البطاقات من الملف كاملاً'**
  String get studyGeneratingCards;

  /// No description provided for @studyGeneratingMcqs.
  ///
  /// In ar, this message translates to:
  /// **'توليد الأسئلة من الملف كاملاً'**
  String get studyGeneratingMcqs;

  /// No description provided for @studyGeneratingProgress.
  ///
  /// In ar, this message translates to:
  /// **'{done} من {total} جاهز'**
  String studyGeneratingProgress(int done, int total);

  /// No description provided for @studyGeneratingNow.
  ///
  /// In ar, this message translates to:
  /// **'جاري الآن: {title}'**
  String studyGeneratingNow(String title);

  /// No description provided for @studyGeneratingQueue.
  ///
  /// In ar, this message translates to:
  /// **'في قائمة الانتظار ({count})'**
  String studyGeneratingQueue(int count);

  /// No description provided for @studyLeaveHint.
  ///
  /// In ar, this message translates to:
  /// **'التجهيز يكمل على الخادم حتى لو طلعت من التطبيق.'**
  String get studyLeaveHint;

  /// No description provided for @studyEmptyOwner.
  ///
  /// In ar, this message translates to:
  /// **'جهّز أدوات الدراسة من صفحة الكتاب أولاً.'**
  String get studyEmptyOwner;

  /// No description provided for @studyRestart.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ من جديد'**
  String get studyRestart;

  /// No description provided for @studyBack.
  ///
  /// In ar, this message translates to:
  /// **'رجوع'**
  String get studyBack;

  /// No description provided for @flashEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد بطاقات لهذا الملف بعد'**
  String get flashEmpty;

  /// No description provided for @flashEmptyShared.
  ///
  /// In ar, this message translates to:
  /// **'لم يولّد صاحب الملف بطاقات بعد.'**
  String get flashEmptyShared;

  /// No description provided for @flashTime.
  ///
  /// In ar, this message translates to:
  /// **'الوقت'**
  String get flashTime;

  /// No description provided for @flashRemaining.
  ///
  /// In ar, this message translates to:
  /// **'متبقي'**
  String get flashRemaining;

  /// No description provided for @flashLearning.
  ///
  /// In ar, this message translates to:
  /// **'قيد التعلم'**
  String get flashLearning;

  /// No description provided for @flashMastered.
  ///
  /// In ar, this message translates to:
  /// **'متقن'**
  String get flashMastered;

  /// No description provided for @flashCardOf.
  ///
  /// In ar, this message translates to:
  /// **'البطاقة: {n}/{total}'**
  String flashCardOf(int n, int total);

  /// No description provided for @flashQuestion.
  ///
  /// In ar, this message translates to:
  /// **'السؤال'**
  String get flashQuestion;

  /// No description provided for @flashAnswer.
  ///
  /// In ar, this message translates to:
  /// **'الإجابة'**
  String get flashAnswer;

  /// No description provided for @flashTapToFlip.
  ///
  /// In ar, this message translates to:
  /// **'اضغط للقلب'**
  String get flashTapToFlip;

  /// No description provided for @flashTapToQuestion.
  ///
  /// In ar, this message translates to:
  /// **'اضغط لرؤية السؤال'**
  String get flashTapToQuestion;

  /// No description provided for @flashSource.
  ///
  /// In ar, this message translates to:
  /// **'المصدر'**
  String get flashSource;

  /// No description provided for @flashExplainTitle.
  ///
  /// In ar, this message translates to:
  /// **'شرح البطاقة'**
  String get flashExplainTitle;

  /// No description provided for @flashTranslate.
  ///
  /// In ar, this message translates to:
  /// **'ترجمة'**
  String get flashTranslate;

  /// No description provided for @flashExplain.
  ///
  /// In ar, this message translates to:
  /// **'شرح'**
  String get flashExplain;

  /// No description provided for @flashPrev.
  ///
  /// In ar, this message translates to:
  /// **'السابق'**
  String get flashPrev;

  /// No description provided for @flashNext.
  ///
  /// In ar, this message translates to:
  /// **'التالي'**
  String get flashNext;

  /// No description provided for @flashLangToggle.
  ///
  /// In ar, this message translates to:
  /// **'تغيير لغة البطاقة'**
  String get flashLangToggle;

  /// No description provided for @flashRateFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر حفظ التقييم. تحقق من اتصالك.'**
  String get flashRateFailed;

  /// No description provided for @rateAgain.
  ///
  /// In ar, this message translates to:
  /// **'لم أتذكر'**
  String get rateAgain;

  /// No description provided for @rateHard.
  ///
  /// In ar, this message translates to:
  /// **'صعبة'**
  String get rateHard;

  /// No description provided for @rateGood.
  ///
  /// In ar, this message translates to:
  /// **'جيدة'**
  String get rateGood;

  /// No description provided for @rateEasy.
  ///
  /// In ar, this message translates to:
  /// **'سهلة'**
  String get rateEasy;

  /// No description provided for @flashDone.
  ///
  /// In ar, this message translates to:
  /// **'انتهت المراجعة 🎉'**
  String get flashDone;

  /// No description provided for @flashDoneBody.
  ///
  /// In ar, this message translates to:
  /// **'راجعت {count} بطاقة في {time} — متقن {mastered}، قيد التعلم {learning}.'**
  String flashDoneBody(int count, String time, int mastered, int learning);

  /// No description provided for @flashReviewHard.
  ///
  /// In ar, this message translates to:
  /// **'راجع البطاقات الصعبة'**
  String get flashReviewHard;

  /// No description provided for @labelQuestionBi.
  ///
  /// In ar, this message translates to:
  /// **'QUESTION / السؤال'**
  String get labelQuestionBi;

  /// No description provided for @labelAnswerBi.
  ///
  /// In ar, this message translates to:
  /// **'ANSWER / الإجابة'**
  String get labelAnswerBi;

  /// No description provided for @labelTermBi.
  ///
  /// In ar, this message translates to:
  /// **'TERM / المصطلح'**
  String get labelTermBi;

  /// No description provided for @quizEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد اختبار لهذا الملف بعد'**
  String get quizEmpty;

  /// No description provided for @quizEmptyShared.
  ///
  /// In ar, this message translates to:
  /// **'لم يولّد صاحب الملف أسئلة بعد.'**
  String get quizEmptyShared;

  /// No description provided for @quizQuestionOf.
  ///
  /// In ar, this message translates to:
  /// **'السؤال {n} من {total}'**
  String quizQuestionOf(int n, int total);

  /// No description provided for @quizPage.
  ///
  /// In ar, this message translates to:
  /// **'صفحة {page}'**
  String quizPage(int page);

  /// No description provided for @quizScore.
  ///
  /// In ar, this message translates to:
  /// **'النتيجة: {score}'**
  String quizScore(int score);

  /// No description provided for @quizFlagged.
  ///
  /// In ar, this message translates to:
  /// **'هذا السؤال يحتاج مراجعة'**
  String get quizFlagged;

  /// No description provided for @quizCorrect.
  ///
  /// In ar, this message translates to:
  /// **'إجابة صحيحة ✓'**
  String get quizCorrect;

  /// No description provided for @quizWrong.
  ///
  /// In ar, this message translates to:
  /// **'إجابة خاطئة ✗'**
  String get quizWrong;

  /// No description provided for @quizSaveFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذر حفظ إجابتك. اختر الإجابة مرة أخرى.'**
  String get quizSaveFailed;

  /// No description provided for @quizHint.
  ///
  /// In ar, this message translates to:
  /// **'تلميح'**
  String get quizHint;

  /// No description provided for @quizSkip.
  ///
  /// In ar, this message translates to:
  /// **'تخطي'**
  String get quizSkip;

  /// No description provided for @quizResult.
  ///
  /// In ar, this message translates to:
  /// **'النتيجة: {score} / {total}'**
  String quizResult(int score, int total);

  /// No description provided for @quizAnsweredSome.
  ///
  /// In ar, this message translates to:
  /// **'جاوبت {answered} من {total} سؤال.'**
  String quizAnsweredSome(int answered, int total);

  /// No description provided for @quizAllCorrect.
  ///
  /// In ar, this message translates to:
  /// **'ممتاز! كل الإجابات صحيحة 🎉'**
  String get quizAllCorrect;

  /// No description provided for @quizReviewWrong.
  ///
  /// In ar, this message translates to:
  /// **'راجع الأسئلة الغلط وجرّب مرة ثانية.'**
  String get quizReviewWrong;

  /// No description provided for @quizRetryWrong.
  ///
  /// In ar, this message translates to:
  /// **'أعد الأسئلة الغلط'**
  String get quizRetryWrong;

  /// No description provided for @quizDot.
  ///
  /// In ar, this message translates to:
  /// **'السؤال {n}'**
  String quizDot(int n);

  /// No description provided for @summaryTitle.
  ///
  /// In ar, this message translates to:
  /// **'الملخص'**
  String get summaryTitle;

  /// No description provided for @summaryShowAr.
  ///
  /// In ar, this message translates to:
  /// **'عرض بالعربي'**
  String get summaryShowAr;

  /// No description provided for @summaryShowEn.
  ///
  /// In ar, this message translates to:
  /// **'عرض بالإنجليزي'**
  String get summaryShowEn;

  /// No description provided for @summaryCopyLink.
  ///
  /// In ar, this message translates to:
  /// **'نسخ الرابط'**
  String get summaryCopyLink;

  /// No description provided for @summaryLinkCopied.
  ///
  /// In ar, this message translates to:
  /// **'تم نسخ الرابط'**
  String get summaryLinkCopied;

  /// No description provided for @summaryCompose.
  ///
  /// In ar, this message translates to:
  /// **'تجهيز ملخص منظم'**
  String get summaryCompose;

  /// No description provided for @summaryComposeBody.
  ///
  /// In ar, this message translates to:
  /// **'حوّل هذا الجزء إلى ملخص طبي منظم: تعريف، أعراض، تشخيص، علاج، ونقاط خطر.'**
  String get summaryComposeBody;

  /// No description provided for @summaryEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد ملخص جاهز بعد'**
  String get summaryEmpty;

  /// No description provided for @summaryEmptyShared.
  ///
  /// In ar, this message translates to:
  /// **'لم يجهّز صاحب الملف الملخص بعد.'**
  String get summaryEmptyShared;

  /// No description provided for @efSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'أهم معلومات الامتحان'**
  String get efSubtitle;

  /// No description provided for @efCardCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} معلومة مركّزة'**
  String efCardCount(int count);

  /// No description provided for @efPreparing.
  ///
  /// In ar, this message translates to:
  /// **'نجهّز Exam Focus…'**
  String get efPreparing;

  /// No description provided for @efStartFailed.
  ///
  /// In ar, this message translates to:
  /// **'ما قدرنا نبدأ Exam Focus'**
  String get efStartFailed;

  /// No description provided for @efTryAgain.
  ///
  /// In ar, this message translates to:
  /// **'حاول مرة ثانية'**
  String get efTryAgain;

  /// No description provided for @efUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'Exam Focus غير متاح'**
  String get efUnavailable;

  /// No description provided for @efCannotOpen.
  ///
  /// In ar, this message translates to:
  /// **'تعذر فتح هذا الملف.'**
  String get efCannotOpen;

  /// No description provided for @efAnalysisFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذر تحليل الملف'**
  String get efAnalysisFailed;

  /// No description provided for @efNothingFound.
  ///
  /// In ar, this message translates to:
  /// **'لم نجد معلومات امتحانية واضحة 🤔'**
  String get efNothingFound;

  /// No description provided for @efTryRegenerate.
  ///
  /// In ar, this message translates to:
  /// **'جرّب إعادة التوليد.'**
  String get efTryRegenerate;

  /// No description provided for @efRegenerate.
  ///
  /// In ar, this message translates to:
  /// **'إعادة التوليد'**
  String get efRegenerate;

  /// No description provided for @efRegenerateConfirm.
  ///
  /// In ar, this message translates to:
  /// **'إعادة توليد Exam Focus من جديد؟ البطاقات الحالية والمحفوظة رح تنحذف.'**
  String get efRegenerateConfirm;

  /// No description provided for @efSearch.
  ///
  /// In ar, this message translates to:
  /// **'بحث في البطاقات'**
  String get efSearch;

  /// No description provided for @efSearchHint.
  ///
  /// In ar, this message translates to:
  /// **'ابحث: chemical burns، 15–30 minutes…'**
  String get efSearchHint;

  /// No description provided for @efClearSearch.
  ///
  /// In ar, this message translates to:
  /// **'مسح البحث'**
  String get efClearSearch;

  /// No description provided for @efAll.
  ///
  /// In ar, this message translates to:
  /// **'الكل'**
  String get efAll;

  /// No description provided for @efSaved.
  ///
  /// In ar, this message translates to:
  /// **'راجعها لاحقًا'**
  String get efSaved;

  /// No description provided for @efSave.
  ///
  /// In ar, this message translates to:
  /// **'احفظ للمراجعة لاحقًا'**
  String get efSave;

  /// No description provided for @efUnsave.
  ///
  /// In ar, this message translates to:
  /// **'إزالة من المحفوظة'**
  String get efUnsave;

  /// No description provided for @efProgress.
  ///
  /// In ar, this message translates to:
  /// **'تقدّمك في البطاقات'**
  String get efProgress;

  /// No description provided for @efNoMatch.
  ///
  /// In ar, this message translates to:
  /// **'ما في بطاقات تطابق 🔎'**
  String get efNoMatch;

  /// No description provided for @efNoMatchHint.
  ///
  /// In ar, this message translates to:
  /// **'جرّب كلمة ثانية أو اختر «الكل».'**
  String get efNoMatchHint;

  /// No description provided for @efPartial.
  ///
  /// In ar, this message translates to:
  /// **'⚠️ تعذر تحليل ص {ranges}.'**
  String efPartial(String ranges);

  /// No description provided for @efCoverage.
  ///
  /// In ar, this message translates to:
  /// **'📊 البطاقات غطّت {covered}/{total} صفحة محتوى'**
  String efCoverage(int covered, int total);

  /// No description provided for @efNoTextPages.
  ///
  /// In ar, this message translates to:
  /// **'{count} صفحة بدون نص مقروء'**
  String efNoTextPages(int count);

  /// No description provided for @efProgressTitle.
  ///
  /// In ar, this message translates to:
  /// **'⏳ نحلل ملفك كاملًا…'**
  String get efProgressTitle;

  /// No description provided for @efProgressBody.
  ///
  /// In ar, this message translates to:
  /// **'نقرأ كل الصفحات من أولها لآخرها ونستخرج المعلومات المهمة للامتحان. تقدر تطلع وترجع، الشغل مستمر على الخادم.'**
  String get efProgressBody;

  /// No description provided for @efStageAnalyse.
  ///
  /// In ar, this message translates to:
  /// **'تحليل كل صفحات الملف'**
  String get efStageAnalyse;

  /// No description provided for @efStageUnits.
  ///
  /// In ar, this message translates to:
  /// **'{done}/{total} جزء'**
  String efStageUnits(int done, int total);

  /// No description provided for @efStageExtract.
  ///
  /// In ar, this message translates to:
  /// **'استخراج المعلومات عالية الأهمية'**
  String get efStageExtract;

  /// No description provided for @efStageFacts.
  ///
  /// In ar, this message translates to:
  /// **'{count} معلومة'**
  String efStageFacts(int count);

  /// No description provided for @efStageDedupe.
  ///
  /// In ar, this message translates to:
  /// **'إزالة التكرار'**
  String get efStageDedupe;

  /// No description provided for @efStageBuild.
  ///
  /// In ar, this message translates to:
  /// **'بناء بطاقات Exam Focus'**
  String get efStageBuild;

  /// No description provided for @efStageCoverage.
  ///
  /// In ar, this message translates to:
  /// **'التحقق من تغطية الملف كاملًا'**
  String get efStageCoverage;

  /// No description provided for @efUnitPages.
  ///
  /// In ar, this message translates to:
  /// **'ص {range}'**
  String efUnitPages(String range);

  /// No description provided for @mindmapIntro.
  ///
  /// In ar, this message translates to:
  /// **'خريطة دراسية مرتبطة بالملخص، المصطلحات، البطاقات، وأسئلة الاختبار.'**
  String get mindmapIntro;

  /// No description provided for @mindmapChapters.
  ///
  /// In ar, this message translates to:
  /// **'الفصول الجاهزة'**
  String get mindmapChapters;

  /// No description provided for @mindmapBranches.
  ///
  /// In ar, this message translates to:
  /// **'الأقسام الرئيسية'**
  String get mindmapBranches;

  /// No description provided for @mindmapConcepts.
  ///
  /// In ar, this message translates to:
  /// **'المفاهيم المرتبطة'**
  String get mindmapConcepts;

  /// No description provided for @mindmapExamPoints.
  ///
  /// In ar, this message translates to:
  /// **'نقاط عالية العائد'**
  String get mindmapExamPoints;

  /// No description provided for @mindmapEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد فصول مكتملة بعد'**
  String get mindmapEmpty;

  /// No description provided for @mindmapEmptyHint.
  ///
  /// In ar, this message translates to:
  /// **'ستظهر الخريطة تلقائيًا بعد اكتمال تحليل الكتاب.'**
  String get mindmapEmptyHint;

  /// No description provided for @mindmapNotBuilt.
  ///
  /// In ar, this message translates to:
  /// **'جاهز للبناء'**
  String get mindmapNotBuilt;

  /// No description provided for @mindmapChapterMeta.
  ///
  /// In ar, this message translates to:
  /// **'{branches} أقسام · {points} نقاط مهمة'**
  String mindmapChapterMeta(int branches, int points);

  /// No description provided for @mindmapSharedNotBuilt.
  ///
  /// In ar, this message translates to:
  /// **'لم يبنِ صاحب الملف خريطة هذا الفصل بعد.'**
  String get mindmapSharedNotBuilt;

  /// No description provided for @mindmapBuildHint.
  ///
  /// In ar, this message translates to:
  /// **'اربط الشرح الإنجليزي والعربي بالمصطلحات والبطاقات والأسئلة في خريطة واحدة.'**
  String get mindmapBuildHint;

  /// No description provided for @mindmapBuildFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذر بناء الخريطة، حاول مرة أخرى.'**
  String get mindmapBuildFailed;

  /// No description provided for @mindmapBuild.
  ///
  /// In ar, this message translates to:
  /// **'بناء الخريطة'**
  String get mindmapBuild;

  /// No description provided for @mindmapQueued.
  ///
  /// In ar, this message translates to:
  /// **'في قائمة الانتظار…'**
  String get mindmapQueued;

  /// No description provided for @mindmapBuilding.
  ///
  /// In ar, this message translates to:
  /// **'جاري البناء…'**
  String get mindmapBuilding;

  /// No description provided for @mindmapOpenSummary.
  ///
  /// In ar, this message translates to:
  /// **'فتح الملخص'**
  String get mindmapOpenSummary;

  /// No description provided for @mindmapOpenCards.
  ///
  /// In ar, this message translates to:
  /// **'فتح البطاقات'**
  String get mindmapOpenCards;

  /// No description provided for @mindmapKeyPoints.
  ///
  /// In ar, this message translates to:
  /// **'High-Yield / أهم النقاط'**
  String get mindmapKeyPoints;

  /// No description provided for @mindmapVisuals.
  ///
  /// In ar, this message translates to:
  /// **'Visual anchors / الصور والمخططات'**
  String get mindmapVisuals;

  /// No description provided for @mindmapSourceLinked.
  ///
  /// In ar, this message translates to:
  /// **'قسم مرتبط بالمصدر'**
  String get mindmapSourceLinked;

  /// No description provided for @mindmapPages.
  ///
  /// In ar, this message translates to:
  /// **'صفحات {pages}'**
  String mindmapPages(String pages);

  /// No description provided for @mindmapConceptsLabel.
  ///
  /// In ar, this message translates to:
  /// **'Concepts / المفاهيم'**
  String get mindmapConceptsLabel;

  /// No description provided for @mindmapExamLabel.
  ///
  /// In ar, this message translates to:
  /// **'Exam focus / نقاط الامتحان'**
  String get mindmapExamLabel;

  /// No description provided for @mindmapPromptsLabel.
  ///
  /// In ar, this message translates to:
  /// **'Recall prompts / أسئلة الاستدعاء'**
  String get mindmapPromptsLabel;

  /// No description provided for @mindmapFooter.
  ///
  /// In ar, this message translates to:
  /// **'الخريطة لا تستبدل الملخص؛ هي تعيد تنظيمه مع البطاقات والأسئلة حتى ترى الصورة الكاملة وتعرف أين تراجع.'**
  String get mindmapFooter;

  /// No description provided for @matchSeconds.
  ///
  /// In ar, this message translates to:
  /// **'{seconds} ثانية'**
  String matchSeconds(String seconds);

  /// No description provided for @matchNewRound.
  ///
  /// In ar, this message translates to:
  /// **'جولة جديدة'**
  String get matchNewRound;

  /// No description provided for @matchHint.
  ///
  /// In ar, this message translates to:
  /// **'اضغط السؤال ثم جوابه ليختفيا — بأسرع وقت! ⚡'**
  String get matchHint;

  /// No description provided for @matchNeedCards.
  ///
  /// In ar, this message translates to:
  /// **'نحتاج بطاقات أولاً 🃏'**
  String get matchNeedCards;

  /// No description provided for @matchNeedCardsHint.
  ///
  /// In ar, this message translates to:
  /// **'ولّد بطاقات هذا الملف، ثم ارجع للعب ✨'**
  String get matchNeedCardsHint;

  /// No description provided for @matchMakeCards.
  ///
  /// In ar, this message translates to:
  /// **'توليد البطاقات'**
  String get matchMakeCards;

  /// No description provided for @matchDone.
  ///
  /// In ar, this message translates to:
  /// **'{seconds} ثانية 🎉'**
  String matchDone(String seconds);

  /// No description provided for @matchRecord.
  ///
  /// In ar, this message translates to:
  /// **'رقم قياسي جديد! 🏆 أداء رائع 💪'**
  String get matchRecord;

  /// No description provided for @matchBest.
  ///
  /// In ar, this message translates to:
  /// **'أفضل وقت لك: {seconds} ثانية — تقدر تكسره! 🔥'**
  String matchBest(String seconds);

  /// No description provided for @matchMistakes.
  ///
  /// In ar, this message translates to:
  /// **'أخطاء: {count} (+ثانية لكل خطأ)'**
  String matchMistakes(int count);

  /// No description provided for @matchPlayAgain.
  ///
  /// In ar, this message translates to:
  /// **'العب مرة ثانية'**
  String get matchPlayAgain;

  /// No description provided for @matchBestLine.
  ///
  /// In ar, this message translates to:
  /// **'🏆 أفضل وقت: {seconds} ثانية'**
  String matchBestLine(String seconds);

  /// No description provided for @reviewTitle.
  ///
  /// In ar, this message translates to:
  /// **'المراجعة اليومية'**
  String get reviewTitle;

  /// No description provided for @reviewEmpty.
  ///
  /// In ar, this message translates to:
  /// **'ممتاز، ما في بطاقات مستحقة اليوم'**
  String get reviewEmpty;

  /// No description provided for @reviewEmptyHint.
  ///
  /// In ar, this message translates to:
  /// **'ارجع بعدين، أو ارفع كتابًا أو ملفًا جديدًا.'**
  String get reviewEmptyHint;

  /// No description provided for @reviewLeft.
  ///
  /// In ar, this message translates to:
  /// **'باقي لك {count} بطاقة'**
  String reviewLeft(int count);

  /// No description provided for @reviewRemaining.
  ///
  /// In ar, this message translates to:
  /// **'{count} متبقية'**
  String reviewRemaining(int count);

  /// No description provided for @reviewMastered.
  ///
  /// In ar, this message translates to:
  /// **'{count} أتقنتها'**
  String reviewMastered(int count);

  /// No description provided for @reviewViewInBook.
  ///
  /// In ar, this message translates to:
  /// **'عرض في الكتاب'**
  String get reviewViewInBook;

  /// No description provided for @reviewShowAnswer.
  ///
  /// In ar, this message translates to:
  /// **'اظهر الإجابة'**
  String get reviewShowAnswer;

  /// No description provided for @reviewRelatedTerm.
  ///
  /// In ar, this message translates to:
  /// **'المصطلح المرتبط'**
  String get reviewRelatedTerm;

  /// No description provided for @reviewExplain.
  ///
  /// In ar, this message translates to:
  /// **'اشرحها ببساطة'**
  String get reviewExplain;

  /// No description provided for @reviewSimpler.
  ///
  /// In ar, this message translates to:
  /// **'بشكل أبسط'**
  String get reviewSimpler;

  /// No description provided for @statsIntro.
  ///
  /// In ar, this message translates to:
  /// **'تقدمك بالأرقام — نظرة سريعة على مراجعتك ودقّتك.'**
  String get statsIntro;

  /// No description provided for @statsReviewed.
  ///
  /// In ar, this message translates to:
  /// **'بطاقات تمت مراجعتها'**
  String get statsReviewed;

  /// No description provided for @statsReviewedHint.
  ///
  /// In ar, this message translates to:
  /// **'إجمالي المراجعات'**
  String get statsReviewedHint;

  /// No description provided for @statsAccuracy.
  ///
  /// In ar, this message translates to:
  /// **'نسبة الإجابات الصحيحة'**
  String get statsAccuracy;

  /// No description provided for @statsAccuracyHint.
  ///
  /// In ar, this message translates to:
  /// **'من الأسئلة اللي جاوبت عليها'**
  String get statsAccuracyHint;

  /// No description provided for @statsStreak.
  ///
  /// In ar, this message translates to:
  /// **'سلسلة الأيام'**
  String get statsStreak;

  /// No description provided for @statsStreakHint.
  ///
  /// In ar, this message translates to:
  /// **'يوم متواصل'**
  String get statsStreakHint;

  /// No description provided for @statsHours.
  ///
  /// In ar, this message translates to:
  /// **'ساعات الدراسة'**
  String get statsHours;

  /// No description provided for @statsHoursHint.
  ///
  /// In ar, this message translates to:
  /// **'ساعة تقريبًا'**
  String get statsHoursHint;

  /// No description provided for @weakTitle.
  ///
  /// In ar, this message translates to:
  /// **'نقاط الضعف'**
  String get weakTitle;

  /// No description provided for @weakRowHint.
  ///
  /// In ar, this message translates to:
  /// **'الأسئلة اللي غلطت فيها'**
  String get weakRowHint;

  /// No description provided for @weakIntro.
  ///
  /// In ar, this message translates to:
  /// **'أسئلة آخر إجابة لك عليها كانت غلط — جاوب صح عشان تختفي من القائمة.'**
  String get weakIntro;

  /// No description provided for @weakChapters.
  ///
  /// In ar, this message translates to:
  /// **'أضعف الفصول'**
  String get weakChapters;

  /// No description provided for @weakEmpty.
  ///
  /// In ar, this message translates to:
  /// **'ما في نقاط ضعف حاليًا'**
  String get weakEmpty;

  /// No description provided for @weakEmptyHint.
  ///
  /// In ar, this message translates to:
  /// **'لسه ما جاوبت غلط على أي سؤال، أو جاوبت صح على كل اللي غلطته.'**
  String get weakEmptyHint;

  /// No description provided for @todayTitle.
  ///
  /// In ar, this message translates to:
  /// **'خطة اليوم'**
  String get todayTitle;

  /// No description provided for @todayRowHint.
  ///
  /// In ar, this message translates to:
  /// **'المستحق، أقرب امتحان، الأسبوع القادم'**
  String get todayRowHint;

  /// No description provided for @todayIntro.
  ///
  /// In ar, this message translates to:
  /// **'ماذا ستدرس اليوم؟ نظرة سريعة على كل موادك في مكان واحد.'**
  String get todayIntro;

  /// No description provided for @todayDue.
  ///
  /// In ar, this message translates to:
  /// **'المستحق اليوم'**
  String get todayDue;

  /// No description provided for @todayDueCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} بطاقة بانتظار مراجعتك من ملفات الأسئلة وكتبي معًا.'**
  String todayDueCount(int count);

  /// No description provided for @todayStartReview.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ المراجعة'**
  String get todayStartReview;

  /// No description provided for @todayNothingDue.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد بطاقات مستحقة الآن.'**
  String get todayNothingDue;

  /// No description provided for @todayExam.
  ///
  /// In ar, this message translates to:
  /// **'موعد الاختبار القادم'**
  String get todayExam;

  /// No description provided for @todayExamLine.
  ///
  /// In ar, this message translates to:
  /// **'{name} — {date} (بعد {days} يوم)'**
  String todayExamLine(String name, String date, int days);

  /// No description provided for @todayContinue.
  ///
  /// In ar, this message translates to:
  /// **'تابع القراءة'**
  String get todayContinue;

  /// No description provided for @todayNoBook.
  ///
  /// In ar, this message translates to:
  /// **'ارفع كتابك الأول لتبدأ.'**
  String get todayNoBook;

  /// No description provided for @todayOpenBook.
  ///
  /// In ar, this message translates to:
  /// **'افتح الكتاب'**
  String get todayOpenBook;

  /// No description provided for @todayForecast.
  ///
  /// In ar, this message translates to:
  /// **'الأسبوع القادم (كتبي)'**
  String get todayForecast;

  /// No description provided for @todayNoForecast.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مراجعات مجدولة قريبًا.'**
  String get todayNoForecast;

  /// No description provided for @todayFolders.
  ///
  /// In ar, this message translates to:
  /// **'موادك'**
  String get todayFolders;

  /// No description provided for @todayFolderBooks.
  ///
  /// In ar, this message translates to:
  /// **'{count} كتاب'**
  String todayFolderBooks(int count);

  /// No description provided for @todayFolderExam.
  ///
  /// In ar, this message translates to:
  /// **'امتحان {date}'**
  String todayFolderExam(String date);

  /// No description provided for @bookMoveFolder.
  ///
  /// In ar, this message translates to:
  /// **'نقل إلى مجلد'**
  String get bookMoveFolder;

  /// No description provided for @bookRemoveShared.
  ///
  /// In ar, this message translates to:
  /// **'إزالة من مكتبتي'**
  String get bookRemoveShared;

  /// No description provided for @bookRemoveSharedBody.
  ///
  /// In ar, this message translates to:
  /// **'إزالة هذا الملف من مكتبتك؟ يبقى الأصل عند صاحبه، ويمكنه مشاركته معك من جديد.'**
  String get bookRemoveSharedBody;

  /// No description provided for @studyKnowledgeLine.
  ///
  /// In ar, this message translates to:
  /// **'🧠 المعرفة: {tool} تغطي {covered}/{total} حقيقة'**
  String studyKnowledgeLine(String tool, int covered, int total);

  /// No description provided for @studyRebuildCards.
  ///
  /// In ar, this message translates to:
  /// **'✨ أعد بناء البطاقات من قاعدة المعرفة'**
  String get studyRebuildCards;

  /// No description provided for @studyRebuildMcqs.
  ///
  /// In ar, this message translates to:
  /// **'✨ أعد بناء الأسئلة من قاعدة المعرفة'**
  String get studyRebuildMcqs;

  /// No description provided for @studyRebuildTitle.
  ///
  /// In ar, this message translates to:
  /// **'إعادة البناء'**
  String get studyRebuildTitle;

  /// No description provided for @studyRebuildCardsConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سيتم استبدال البطاقات الحالية ببطاقات مبنية من قاعدة المعرفة (كل حقائق الملف)، وسيضيع تقدّم مراجعة البطاقات القديمة. متابعة؟'**
  String get studyRebuildCardsConfirm;

  /// No description provided for @studyRebuildMcqsConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سيتم استبدال الأسئلة الحالية بأسئلة تطبيقية مبنية من قاعدة المعرفة (كل حقائق الملف). متابعة؟'**
  String get studyRebuildMcqsConfirm;

  /// No description provided for @studyRebuildNotReady.
  ///
  /// In ar, this message translates to:
  /// **'قاعدة المعرفة غير جاهزة بعد — جرّب لاحقًا.'**
  String get studyRebuildNotReady;

  /// No description provided for @studyMatrixTitle.
  ///
  /// In ar, this message translates to:
  /// **'🧭 خريطة التغطية · {covered}/{total}'**
  String studyMatrixTitle(int covered, int total);

  /// No description provided for @studyMatrixHint.
  ///
  /// In ar, this message translates to:
  /// **'كل حقيقة من Exam Focus ← البطاقات 🃏 والأسئلة ❓ المبنية منها ← صفحاتها.'**
  String get studyMatrixHint;

  /// No description provided for @studyMatrixPages.
  ///
  /// In ar, this message translates to:
  /// **'ص {pages}'**
  String studyMatrixPages(String pages);

  /// No description provided for @readerOpening.
  ///
  /// In ar, this message translates to:
  /// **'نفتح الملف…'**
  String get readerOpening;

  /// No description provided for @readerNoFile.
  ///
  /// In ar, this message translates to:
  /// **'تعذر العثور على هذا الملف'**
  String get readerNoFile;

  /// No description provided for @readerNoFileHint.
  ///
  /// In ar, this message translates to:
  /// **'ارجع لصفحة الكتاب وحاول مرة أخرى.'**
  String get readerNoFileHint;

  /// No description provided for @readerGoTo.
  ///
  /// In ar, this message translates to:
  /// **'الانتقال إلى صفحة'**
  String get readerGoTo;

  /// No description provided for @readerGo.
  ///
  /// In ar, this message translates to:
  /// **'انتقال'**
  String get readerGo;

  /// No description provided for @readerPageOf.
  ///
  /// In ar, this message translates to:
  /// **'صفحة {page} من {count}'**
  String readerPageOf(int page, int count);

  /// No description provided for @readerPageRange.
  ///
  /// In ar, this message translates to:
  /// **'من 1 إلى {count}'**
  String readerPageRange(int count);

  /// No description provided for @readerSearch.
  ///
  /// In ar, this message translates to:
  /// **'بحث في الملف'**
  String get readerSearch;

  /// No description provided for @readerSearchHint.
  ///
  /// In ar, this message translates to:
  /// **'كلمة أو عبارة…'**
  String get readerSearchHint;

  /// No description provided for @readerNoMatches.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد نتائج.'**
  String get readerNoMatches;

  /// No description provided for @readerAskPage.
  ///
  /// In ar, this message translates to:
  /// **'اسأل Niro عن الصفحة'**
  String get readerAskPage;

  /// No description provided for @readerHighlight.
  ///
  /// In ar, this message translates to:
  /// **'ظلّل'**
  String get readerHighlight;

  /// No description provided for @readerAskSelection.
  ///
  /// In ar, this message translates to:
  /// **'اسأل Niro'**
  String get readerAskSelection;

  /// No description provided for @readerToolHighlight.
  ///
  /// In ar, this message translates to:
  /// **'تظليل'**
  String get readerToolHighlight;

  /// No description provided for @readerToolPen.
  ///
  /// In ar, this message translates to:
  /// **'قلم'**
  String get readerToolPen;

  /// No description provided for @readerToolEraser.
  ///
  /// In ar, this message translates to:
  /// **'ممحاة'**
  String get readerToolEraser;

  /// No description provided for @readerSaving.
  ///
  /// In ar, this message translates to:
  /// **'جاري الحفظ…'**
  String get readerSaving;

  /// No description provided for @readerSaved.
  ///
  /// In ar, this message translates to:
  /// **'محفوظ'**
  String get readerSaved;

  /// No description provided for @readerSaveFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذر الحفظ'**
  String get readerSaveFailed;

  /// No description provided for @readerHintHighlight.
  ///
  /// In ar, this message translates to:
  /// **'حدّد نصًا على الصفحة ثم اضغط «ظلّل».'**
  String get readerHintHighlight;

  /// No description provided for @readerHintPen.
  ///
  /// In ar, this message translates to:
  /// **'ارسم بحرّية فوق الصفحة لتحديد النقاط المهمة.'**
  String get readerHintPen;

  /// No description provided for @readerHintEraser.
  ///
  /// In ar, this message translates to:
  /// **'مرّر على التظليل أو الرسم لمسحه.'**
  String get readerHintEraser;

  /// No description provided for @askTitle.
  ///
  /// In ar, this message translates to:
  /// **'اسأل Niro · صفحة {page}'**
  String askTitle(int page);

  /// No description provided for @askWholePage.
  ///
  /// In ar, this message translates to:
  /// **'الصفحة {page} كاملة — حدّد نصًا قبل الضغط لتسأل عنه وحده.'**
  String askWholePage(int page);

  /// No description provided for @askExplain.
  ///
  /// In ar, this message translates to:
  /// **'اشرح ببساطة'**
  String get askExplain;

  /// No description provided for @askExplainPage.
  ///
  /// In ar, this message translates to:
  /// **'اشرح الصفحة'**
  String get askExplainPage;

  /// No description provided for @askArabic.
  ///
  /// In ar, this message translates to:
  /// **'اشرح بالعربي'**
  String get askArabic;

  /// No description provided for @askExam.
  ///
  /// In ar, this message translates to:
  /// **'سؤال امتحان'**
  String get askExam;

  /// No description provided for @askSummarize.
  ///
  /// In ar, this message translates to:
  /// **'لخّص'**
  String get askSummarize;

  /// No description provided for @askSummarizePage.
  ///
  /// In ar, this message translates to:
  /// **'لخّص الصفحة'**
  String get askSummarizePage;

  /// No description provided for @askThinking.
  ///
  /// In ar, this message translates to:
  /// **'Niro يكتب…'**
  String get askThinking;

  /// No description provided for @askHint.
  ///
  /// In ar, this message translates to:
  /// **'اسأل عن هذا النص…'**
  String get askHint;

  /// No description provided for @askSend.
  ///
  /// In ar, this message translates to:
  /// **'إرسال'**
  String get askSend;

  /// No description provided for @askStop.
  ///
  /// In ar, this message translates to:
  /// **'إيقاف'**
  String get askStop;

  /// No description provided for @bookChatTitle.
  ///
  /// In ar, this message translates to:
  /// **'اسأل Niro عن هذا الملف'**
  String get bookChatTitle;

  /// No description provided for @bookChatHello.
  ///
  /// In ar, this message translates to:
  /// **'أهلاً، أنا Niro 👋 اسألني أي شيء عن هذا الملف.'**
  String get bookChatHello;

  /// No description provided for @qfTitle.
  ///
  /// In ar, this message translates to:
  /// **'بنوك الأسئلة'**
  String get qfTitle;

  /// No description provided for @qfIntro.
  ///
  /// In ar, this message translates to:
  /// **'أسئلة مستخرجة مباشرة من ملفاتك — بدون توليد بالذكاء الاصطناعي.'**
  String get qfIntro;

  /// No description provided for @qfUpload.
  ///
  /// In ar, this message translates to:
  /// **'رفع ملف أسئلة'**
  String get qfUpload;

  /// No description provided for @qfUploadTitle.
  ///
  /// In ar, this message translates to:
  /// **'رفع ملف أسئلة'**
  String get qfUploadTitle;

  /// No description provided for @qfEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد ملفات أسئلة بعد'**
  String get qfEmpty;

  /// No description provided for @qfEmptyHint.
  ///
  /// In ar, this message translates to:
  /// **'ارفع ملف أسئلة واختر «ملف أسئلة» عند الرفع.'**
  String get qfEmptyHint;

  /// No description provided for @qfCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} سؤال'**
  String qfCount(int count);

  /// No description provided for @qfStatusExtracting.
  ///
  /// In ar, this message translates to:
  /// **'جاري الاستخراج…'**
  String get qfStatusExtracting;

  /// No description provided for @qfStatusComplete.
  ///
  /// In ar, this message translates to:
  /// **'تم الاستخراج'**
  String get qfStatusComplete;

  /// No description provided for @qfStatusFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذر الاستخراج'**
  String get qfStatusFailed;

  /// No description provided for @qfStatusPending.
  ///
  /// In ar, this message translates to:
  /// **'قيد الانتظار'**
  String get qfStatusPending;

  /// No description provided for @qfExtracting.
  ///
  /// In ar, this message translates to:
  /// **'جاري استخراج الأسئلة من الملف — تقدر تسكّر الصفحة وترجع بعدين.'**
  String get qfExtracting;

  /// No description provided for @qfFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذر استخراج الأسئلة من هذا الملف.'**
  String get qfFailed;

  /// No description provided for @qfRetry.
  ///
  /// In ar, this message translates to:
  /// **'إعادة المعالجة'**
  String get qfRetry;

  /// No description provided for @qfNoQuestions.
  ///
  /// In ar, this message translates to:
  /// **'لم يتم العثور على أسئلة'**
  String get qfNoQuestions;

  /// No description provided for @qfExtractedCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} سؤال مستخرج'**
  String qfExtractedCount(int count);

  /// No description provided for @qfEnriching.
  ///
  /// In ar, this message translates to:
  /// **'جاري إضافة الصور والشرح ({done}/{total})'**
  String qfEnriching(int done, int total);

  /// No description provided for @qfKind.
  ///
  /// In ar, this message translates to:
  /// **'ملف أسئلة'**
  String get qfKind;

  /// No description provided for @qfKindNote.
  ///
  /// In ar, this message translates to:
  /// **'سيتم استخراج الأسئلة الموجودة فعليًا في الملف — لن يتم توليد أسئلة جديدة بالذكاء الاصطناعي.'**
  String get qfKindNote;

  /// No description provided for @qfSubmit.
  ///
  /// In ar, this message translates to:
  /// **'استخراج الأسئلة'**
  String get qfSubmit;

  /// No description provided for @qfQuotaLeft.
  ///
  /// In ar, this message translates to:
  /// **'متبقي اليوم: {left} من {limit} ملفات أسئلة'**
  String qfQuotaLeft(int left, int limit);

  /// No description provided for @uploadStepKind.
  ///
  /// In ar, this message translates to:
  /// **'نوع الملف'**
  String get uploadStepKind;

  /// No description provided for @questionsLabel.
  ///
  /// In ar, this message translates to:
  /// **'السؤال'**
  String get questionsLabel;

  /// No description provided for @questionsPosition.
  ///
  /// In ar, this message translates to:
  /// **'السؤال {index} من {total}'**
  String questionsPosition(int index, int total);

  /// No description provided for @questionsTally.
  ///
  /// In ar, this message translates to:
  /// **'أجبت {answered} · صحيح {correct}'**
  String questionsTally(int answered, int correct);

  /// No description provided for @questionsProgressLabel.
  ///
  /// In ar, this message translates to:
  /// **'التقدم في الأسئلة'**
  String get questionsProgressLabel;

  /// No description provided for @questionsCardLabel.
  ///
  /// In ar, this message translates to:
  /// **'سؤال {index} من {total}'**
  String questionsCardLabel(int index, int total);

  /// No description provided for @questionsPickerTitle.
  ///
  /// In ar, this message translates to:
  /// **'انتقل إلى سؤال'**
  String get questionsPickerTitle;

  /// No description provided for @questionsReveal.
  ///
  /// In ar, this message translates to:
  /// **'أظهر الإجابة'**
  String get questionsReveal;

  /// No description provided for @questionsReset.
  ///
  /// In ar, this message translates to:
  /// **'إعادة'**
  String get questionsReset;

  /// No description provided for @questionsNoAnswerInFile.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد إجابة مذكورة لهذا السؤال في الملف.'**
  String get questionsNoAnswerInFile;

  /// No description provided for @questionsNoAnswer.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد إجابة مذكورة لهذا السؤال.'**
  String get questionsNoAnswer;

  /// No description provided for @questionsAiAnswer.
  ///
  /// In ar, this message translates to:
  /// **'إجابة مقترحة من الذكاء الاصطناعي — لم تُذكر إجابة في الملف الأصلي.'**
  String get questionsAiAnswer;

  /// No description provided for @questionsMachineTranslation.
  ///
  /// In ar, this message translates to:
  /// **'ترجمة آلية'**
  String get questionsMachineTranslation;

  /// No description provided for @doctorSetsTitle.
  ///
  /// In ar, this message translates to:
  /// **'مجموعات الدكاترة'**
  String get doctorSetsTitle;

  /// No description provided for @qfUploadIntro.
  ///
  /// In ar, this message translates to:
  /// **'ارفع ملف أسئلة (بنك، امتحان سابق، أسئلة مصوّرة) ونستخرج أسئلته كما هي مع إجاباتها إن وُجدت.'**
  String get qfUploadIntro;

  /// No description provided for @qfStepFile.
  ///
  /// In ar, this message translates to:
  /// **'الملف'**
  String get qfStepFile;

  /// No description provided for @niroTitle.
  ///
  /// In ar, this message translates to:
  /// **'اسأل Niro'**
  String get niroTitle;

  /// No description provided for @niroSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'صاحبك بالدراسة، وقت ما تحتاجه 😌'**
  String get niroSubtitle;

  /// No description provided for @niroNewChat.
  ///
  /// In ar, this message translates to:
  /// **'جديدة'**
  String get niroNewChat;

  /// No description provided for @niroHello.
  ///
  /// In ar, this message translates to:
  /// **'أهلاً! أنا Niro 👋'**
  String get niroHello;

  /// No description provided for @niroHelloName.
  ///
  /// In ar, this message translates to:
  /// **'أهلاً {name}! أنا Niro 👋'**
  String niroHelloName(String name);

  /// No description provided for @niroAskAnything.
  ///
  /// In ar, this message translates to:
  /// **'اسألني أي شيء — شرح، حل، ترجمة، أو صوّرلي السؤال 📸'**
  String get niroAskAnything;

  /// No description provided for @niroStarterPhoto.
  ///
  /// In ar, this message translates to:
  /// **'صوّر سؤالاً أو صفحة وأنا أحلّها لك'**
  String get niroStarterPhoto;

  /// No description provided for @niroReadingPhoto.
  ///
  /// In ar, this message translates to:
  /// **'Niro يقرأ الصورة… 🔍'**
  String get niroReadingPhoto;

  /// No description provided for @niroUnreachable.
  ///
  /// In ar, this message translates to:
  /// **'تعذر الوصول للمساعد، حاول مرة أخرى 🙏'**
  String get niroUnreachable;

  /// No description provided for @niroPhotoFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذر قراءة الصورة، جرّب صورة أخرى 🙏'**
  String get niroPhotoFailed;

  /// No description provided for @niroRemaining.
  ///
  /// In ar, this message translates to:
  /// **'باقي لك {count} رسائل اليوم'**
  String niroRemaining(int count);

  /// No description provided for @niroCopy.
  ///
  /// In ar, this message translates to:
  /// **'نسخ'**
  String get niroCopy;

  /// No description provided for @niroCopied.
  ///
  /// In ar, this message translates to:
  /// **'تم النسخ'**
  String get niroCopied;

  /// No description provided for @niroCamera.
  ///
  /// In ar, this message translates to:
  /// **'تصوير بالكاميرا'**
  String get niroCamera;

  /// No description provided for @niroGallery.
  ///
  /// In ar, this message translates to:
  /// **'اختيار صورة من المعرض'**
  String get niroGallery;

  /// No description provided for @niroHint.
  ///
  /// In ar, this message translates to:
  /// **'اكتب سؤالك هنا…'**
  String get niroHint;

  /// No description provided for @niroHintPhoto.
  ///
  /// In ar, this message translates to:
  /// **'اسأل عن الصورة (اختياري)…'**
  String get niroHintPhoto;

  /// No description provided for @niroAttachedPhoto.
  ///
  /// In ar, this message translates to:
  /// **'الصورة المرفقة'**
  String get niroAttachedPhoto;

  /// No description provided for @niroSentPhoto.
  ///
  /// In ar, this message translates to:
  /// **'الصورة المرسلة'**
  String get niroSentPhoto;

  /// No description provided for @niroRemovePhoto.
  ///
  /// In ar, this message translates to:
  /// **'إزالة الصورة'**
  String get niroRemovePhoto;

  /// No description provided for @niroCameraTitle.
  ///
  /// In ar, this message translates to:
  /// **'نحتاج الكاميرا لتصوير سؤالك 📷'**
  String get niroCameraTitle;

  /// No description provided for @niroCameraWhy1.
  ///
  /// In ar, this message translates to:
  /// **'صوّر سؤالًا أو صفحة أو ملاحظاتك، والمساعد يقرؤها ويحلّها.'**
  String get niroCameraWhy1;

  /// No description provided for @niroCameraWhy2.
  ///
  /// In ar, this message translates to:
  /// **'تُفتح الكاميرا فقط عندما تضغط الزر — لا شيء في الخلفية.'**
  String get niroCameraWhy2;

  /// No description provided for @niroCameraWhy3.
  ///
  /// In ar, this message translates to:
  /// **'الصورة تُرسل للتحليل فقط ولا نخزّنها على خوادمنا.'**
  String get niroCameraWhy3;

  /// No description provided for @niroCameraWhy4.
  ///
  /// In ar, this message translates to:
  /// **'إذا رفضت الإذن يمكنك دائمًا اختيار صورة من المعرض.'**
  String get niroCameraWhy4;

  /// No description provided for @niroNotNow.
  ///
  /// In ar, this message translates to:
  /// **'ليس الآن'**
  String get niroNotNow;

  /// No description provided for @niroCameraDenied.
  ///
  /// In ar, this message translates to:
  /// **'الكاميرا غير مسموحة'**
  String get niroCameraDenied;

  /// No description provided for @niroPhotosDenied.
  ///
  /// In ar, this message translates to:
  /// **'الوصول للصور غير مسموح'**
  String get niroPhotosDenied;

  /// No description provided for @niroDeniedHint.
  ///
  /// In ar, this message translates to:
  /// **'يمكنك السماح بها من إعدادات الجهاز، أو اختيار صورة من المعرض بدلًا من ذلك.'**
  String get niroDeniedHint;

  /// No description provided for @niroOpenSettings.
  ///
  /// In ar, this message translates to:
  /// **'فتح الإعدادات'**
  String get niroOpenSettings;

  /// No description provided for @dsIntro.
  ///
  /// In ar, this message translates to:
  /// **'أسئلة يشاركها دكتورك مع طلابه. الدخول بكود يعطيك إياه الدكتور.'**
  String get dsIntro;

  /// No description provided for @dsCodeLabel.
  ///
  /// In ar, this message translates to:
  /// **'كود الوصول'**
  String get dsCodeLabel;

  /// No description provided for @dsAddSet.
  ///
  /// In ar, this message translates to:
  /// **'أضف المجموعة'**
  String get dsAddSet;

  /// No description provided for @dsChecking.
  ///
  /// In ar, this message translates to:
  /// **'جاري التحقق…'**
  String get dsChecking;

  /// No description provided for @dsAlreadyAdded.
  ///
  /// In ar, this message translates to:
  /// **'هذه المجموعة مضافة لحسابك بالفعل.'**
  String get dsAlreadyAdded;

  /// No description provided for @dsMine.
  ///
  /// In ar, this message translates to:
  /// **'مجموعاتي'**
  String get dsMine;

  /// No description provided for @dsMineEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مجموعات بعد.'**
  String get dsMineEmpty;

  /// No description provided for @dsMineEmptyHint.
  ///
  /// In ar, this message translates to:
  /// **'عندك كود من دكتورك؟ أدخله في الأعلى.'**
  String get dsMineEmptyHint;

  /// No description provided for @dsListedTitle.
  ///
  /// In ar, this message translates to:
  /// **'مجموعات منشورة'**
  String get dsListedTitle;

  /// No description provided for @dsListedNote.
  ///
  /// In ar, this message translates to:
  /// **'تظهر هنا للاطلاع فقط. فتح أي مجموعة يحتاج كودًا من دكتورها.'**
  String get dsListedNote;

  /// No description provided for @dsByCode.
  ///
  /// In ar, this message translates to:
  /// **'🔒 بكود'**
  String get dsByCode;

  /// No description provided for @dsAvailable.
  ///
  /// In ar, this message translates to:
  /// **'متاحة'**
  String get dsAvailable;

  /// No description provided for @dsOpensAt.
  ///
  /// In ar, this message translates to:
  /// **'تفتح {date}'**
  String dsOpensAt(String date);

  /// No description provided for @dsUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'غير متاحة حاليًا'**
  String get dsUnavailable;

  /// No description provided for @dsUntil.
  ///
  /// In ar, this message translates to:
  /// **'حتى {date}'**
  String dsUntil(String date);

  /// No description provided for @dsSetUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'هذه المجموعة غير متاحة حاليًا'**
  String get dsSetUnavailable;

  /// No description provided for @dsFeatureOff.
  ///
  /// In ar, this message translates to:
  /// **'هذه الميزة غير متاحة حاليًا.'**
  String get dsFeatureOff;

  /// No description provided for @dsApplyTitle.
  ///
  /// In ar, this message translates to:
  /// **'حساب دكتور'**
  String get dsApplyTitle;

  /// No description provided for @dsApplyIntro.
  ///
  /// In ar, this message translates to:
  /// **'ارفع ملفات أسئلتك، وأعطِ طلابك أكواد دخول. يبقى حسابك كما هو، ونفس تسجيل الدخول.'**
  String get dsApplyIntro;

  /// No description provided for @dsPending.
  ///
  /// In ar, this message translates to:
  /// **'قيد المراجعة'**
  String get dsPending;

  /// No description provided for @dsPendingBody.
  ///
  /// In ar, this message translates to:
  /// **'طلبك وصل وسيراجعه فريق NiroLearn.'**
  String get dsPendingBody;

  /// No description provided for @dsApproved.
  ///
  /// In ar, this message translates to:
  /// **'دكتور معتمد'**
  String get dsApproved;

  /// No description provided for @dsApprovedBody.
  ///
  /// In ar, this message translates to:
  /// **'حسابك معتمد كدكتور.'**
  String get dsApprovedBody;

  /// No description provided for @dsOpenDashboard.
  ///
  /// In ar, this message translates to:
  /// **'افتح لوحة الدكتور'**
  String get dsOpenDashboard;

  /// No description provided for @dsSuspended.
  ///
  /// In ar, this message translates to:
  /// **'موقوف'**
  String get dsSuspended;

  /// No description provided for @dsSuspendedBody.
  ///
  /// In ar, this message translates to:
  /// **'صلاحيات الدكتور موقوفة حاليًا.'**
  String get dsSuspendedBody;

  /// No description provided for @dsSuspendedHint.
  ///
  /// In ar, this message translates to:
  /// **'مجموعاتك غير متاحة لطلابك أثناء الإيقاف. تواصل معنا لمعرفة السبب.'**
  String get dsSuspendedHint;

  /// No description provided for @dsRejected.
  ///
  /// In ar, this message translates to:
  /// **'لم يُقبل الطلب'**
  String get dsRejected;

  /// No description provided for @dsRejectedBody.
  ///
  /// In ar, this message translates to:
  /// **'لم نتمكن من اعتماد طلبك السابق.'**
  String get dsRejectedBody;

  /// No description provided for @dsRejectedReason.
  ///
  /// In ar, this message translates to:
  /// **'السبب: {reason}'**
  String dsRejectedReason(String reason);

  /// No description provided for @dsRejectedHint.
  ///
  /// In ar, this message translates to:
  /// **'يمكنك تعديل البيانات وإرسال طلب جديد.'**
  String get dsRejectedHint;

  /// No description provided for @dsFullName.
  ///
  /// In ar, this message translates to:
  /// **'الاسم الكامل'**
  String get dsFullName;

  /// No description provided for @dsUniversity.
  ///
  /// In ar, this message translates to:
  /// **'الجامعة'**
  String get dsUniversity;

  /// No description provided for @dsFaculty.
  ///
  /// In ar, this message translates to:
  /// **'الكلية'**
  String get dsFaculty;

  /// No description provided for @dsDepartment.
  ///
  /// In ar, this message translates to:
  /// **'القسم'**
  String get dsDepartment;

  /// No description provided for @dsUniEmail.
  ///
  /// In ar, this message translates to:
  /// **'البريد الجامعي (اختياري، يساعد في التحقق)'**
  String get dsUniEmail;

  /// No description provided for @dsNote.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظة للمراجعة (اختياري)'**
  String get dsNote;

  /// No description provided for @dsSendApplication.
  ///
  /// In ar, this message translates to:
  /// **'أرسل الطلب'**
  String get dsSendApplication;

  /// No description provided for @dsDashboardIntro.
  ///
  /// In ar, this message translates to:
  /// **'مجموعات أسئلة محمية: ترفع الملف مرة واحدة، وطلابك يدخلون بكود.'**
  String get dsDashboardIntro;

  /// No description provided for @dsStatSets.
  ///
  /// In ar, this message translates to:
  /// **'المجموعات'**
  String get dsStatSets;

  /// No description provided for @dsStatPublished.
  ///
  /// In ar, this message translates to:
  /// **'منشورة'**
  String get dsStatPublished;

  /// No description provided for @dsStatDisabled.
  ///
  /// In ar, this message translates to:
  /// **'معطّلة'**
  String get dsStatDisabled;

  /// No description provided for @dsStatCodes.
  ///
  /// In ar, this message translates to:
  /// **'أكواد مولّدة'**
  String get dsStatCodes;

  /// No description provided for @dsStatStudents.
  ///
  /// In ar, this message translates to:
  /// **'طلاب مفعّلون'**
  String get dsStatStudents;

  /// No description provided for @dsNewSet.
  ///
  /// In ar, this message translates to:
  /// **'مجموعة جديدة'**
  String get dsNewSet;

  /// No description provided for @dsDoctorEmptyHint.
  ///
  /// In ar, this message translates to:
  /// **'ارفع ملف أسئلة PDF، راجع الأسئلة المستخرجة، ثم انشرها وولّد أكوادًا لطلابك.'**
  String get dsDoctorEmptyHint;

  /// No description provided for @dsRecent.
  ///
  /// In ar, this message translates to:
  /// **'آخر النشاط'**
  String get dsRecent;

  /// No description provided for @dsStudentsCount.
  ///
  /// In ar, this message translates to:
  /// **'{count} طالب'**
  String dsStudentsCount(int count);

  /// No description provided for @dsCodesUsed.
  ///
  /// In ar, this message translates to:
  /// **'{claimed}/{total} كود مستخدم'**
  String dsCodesUsed(int claimed, int total);

  /// No description provided for @dsNewSetTitle.
  ///
  /// In ar, this message translates to:
  /// **'مجموعة أسئلة جديدة'**
  String get dsNewSetTitle;

  /// No description provided for @dsNewSetIntro.
  ///
  /// In ar, this message translates to:
  /// **'الملف يُعالج مرة واحدة بنفس نظام ملفات الأسئلة. تراجع الأسئلة، ثم تنشر وتولّد الأكواد.'**
  String get dsNewSetIntro;

  /// No description provided for @dsFileLabel.
  ///
  /// In ar, this message translates to:
  /// **'ملف الأسئلة (PDF)'**
  String get dsFileLabel;

  /// No description provided for @dsFileHint.
  ///
  /// In ar, this message translates to:
  /// **'ملف نصي أو ممسوح ضوئيًا — الصفحات المصوّرة تُقرأ بالقراءة الضوئية وتأخذ وقتًا أطول قليلًا. يُحتسب الملف من حصة ملفات الأسئلة في باقتك.'**
  String get dsFileHint;

  /// No description provided for @dsCreateSet.
  ///
  /// In ar, this message translates to:
  /// **'ارفع وأنشئ المجموعة'**
  String get dsCreateSet;

  /// No description provided for @dsStarting.
  ///
  /// In ar, this message translates to:
  /// **'جاري بدء المعالجة…'**
  String get dsStarting;

  /// No description provided for @dsTitle.
  ///
  /// In ar, this message translates to:
  /// **'عنوان المجموعة'**
  String get dsTitle;

  /// No description provided for @dsDescription.
  ///
  /// In ar, this message translates to:
  /// **'الوصف (اختياري)'**
  String get dsDescription;

  /// No description provided for @dsSubject.
  ///
  /// In ar, this message translates to:
  /// **'المادة'**
  String get dsSubject;

  /// No description provided for @dsYear.
  ///
  /// In ar, this message translates to:
  /// **'السنة الدراسية'**
  String get dsYear;

  /// No description provided for @dsExamType.
  ///
  /// In ar, this message translates to:
  /// **'نوع الامتحان'**
  String get dsExamType;

  /// No description provided for @dsVisibility.
  ///
  /// In ar, this message translates to:
  /// **'الظهور'**
  String get dsVisibility;

  /// No description provided for @dsUnlisted.
  ///
  /// In ar, this message translates to:
  /// **'غير مدرجة — تعطي الأكواد لطلابك مباشرة'**
  String get dsUnlisted;

  /// No description provided for @dsListed.
  ///
  /// In ar, this message translates to:
  /// **'مدرجة — يظهر عنوانها للطلاب، والدخول بكود فقط'**
  String get dsListed;

  /// No description provided for @dsListedShort.
  ///
  /// In ar, this message translates to:
  /// **'مدرجة'**
  String get dsListedShort;

  /// No description provided for @dsUnlistedShort.
  ///
  /// In ar, this message translates to:
  /// **'غير مدرجة'**
  String get dsUnlistedShort;

  /// No description provided for @dsStarts.
  ///
  /// In ar, this message translates to:
  /// **'تبدأ'**
  String get dsStarts;

  /// No description provided for @dsEnds.
  ///
  /// In ar, this message translates to:
  /// **'تنتهي'**
  String get dsEnds;

  /// No description provided for @dsPickDate.
  ///
  /// In ar, this message translates to:
  /// **'اختر'**
  String get dsPickDate;

  /// No description provided for @dsClearDate.
  ///
  /// In ar, this message translates to:
  /// **'بدون تاريخ'**
  String get dsClearDate;

  /// No description provided for @dsTabQuestions.
  ///
  /// In ar, this message translates to:
  /// **'الأسئلة'**
  String get dsTabQuestions;

  /// No description provided for @dsTabSettings.
  ///
  /// In ar, this message translates to:
  /// **'الإعدادات'**
  String get dsTabSettings;

  /// No description provided for @dsTabCodes.
  ///
  /// In ar, this message translates to:
  /// **'الأكواد'**
  String get dsTabCodes;

  /// No description provided for @dsTabStudents.
  ///
  /// In ar, this message translates to:
  /// **'الطلاب'**
  String get dsTabStudents;

  /// No description provided for @dsTabAudit.
  ///
  /// In ar, this message translates to:
  /// **'السجل'**
  String get dsTabAudit;

  /// No description provided for @dsProcessing.
  ///
  /// In ar, this message translates to:
  /// **'جاري المعالجة بنفس نظام ملفات الأسئلة. تقدر تسكّر الصفحة وترجع.'**
  String get dsProcessing;

  /// No description provided for @dsReviewFirst.
  ///
  /// In ar, this message translates to:
  /// **'راجع الأسئلة أدناه كما سيراها طلابك.'**
  String get dsReviewFirst;

  /// No description provided for @dsNoEditAfterPublish.
  ///
  /// In ar, this message translates to:
  /// **'بعد النشر لا يمكن تغيير الأسئلة. إن احتجت تعديلها، أنشئ مجموعة جديدة بملف مصحح.'**
  String get dsNoEditAfterPublish;

  /// No description provided for @dsPublish.
  ///
  /// In ar, this message translates to:
  /// **'انشر المجموعة'**
  String get dsPublish;

  /// No description provided for @dsPublished.
  ///
  /// In ar, this message translates to:
  /// **'تم النشر'**
  String get dsPublished;

  /// No description provided for @dsShowAllAnswers.
  ///
  /// In ar, this message translates to:
  /// **'أظهر كل الإجابات'**
  String get dsShowAllAnswers;

  /// No description provided for @dsHideAnswers.
  ///
  /// In ar, this message translates to:
  /// **'إخفاء الإجابات'**
  String get dsHideAnswers;

  /// No description provided for @dsMachineNote.
  ///
  /// In ar, this message translates to:
  /// **'بعض الترجمات آلية (عليها وسم «ترجمة آلية») — راجعها.'**
  String get dsMachineNote;

  /// No description provided for @dsNoQuestionsYet.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد أسئلة مستخرجة بعد.'**
  String get dsNoQuestionsYet;

  /// No description provided for @dsImageChecks.
  ///
  /// In ar, this message translates to:
  /// **'صور تحتاج مراجعة'**
  String get dsImageChecks;

  /// No description provided for @dsImageChecksNote.
  ///
  /// In ar, this message translates to:
  /// **'في هذه الصفحات صورة لم يكن واضحًا لأي سؤال تعود، فلم تُربط بأي سؤال (الأسئلة نفسها ظاهرة للطلاب بدون صورة).'**
  String get dsImageChecksNote;

  /// No description provided for @dsQuestionOnPage.
  ///
  /// In ar, this message translates to:
  /// **'سؤال {index} · صفحة {page}'**
  String dsQuestionOnPage(int index, int page);

  /// No description provided for @dsNeedsReview.
  ///
  /// In ar, this message translates to:
  /// **'تحتاج مراجعة (Needs Review) · {count}'**
  String dsNeedsReview(int count);

  /// No description provided for @dsNeedsReviewNote.
  ///
  /// In ar, this message translates to:
  /// **'هذه الأجزاء لم تُعتبر أسئلة مكتملة، فلا يراها طلابك. لم يُكمل النظام أي نص ناقص من عنده.'**
  String get dsNeedsReviewNote;

  /// No description provided for @dsNoStem.
  ///
  /// In ar, this message translates to:
  /// **'(بدون نص سؤال)'**
  String get dsNoStem;

  /// No description provided for @dsAccess.
  ///
  /// In ar, this message translates to:
  /// **'الوصول'**
  String get dsAccess;

  /// No description provided for @dsAccessNote.
  ///
  /// In ar, this message translates to:
  /// **'التعطيل يوقف وصول كل الطلاب فورًا دون حذف أي شيء، وتقدر تعيد التفعيل متى شئت. الأرشفة نهائية.'**
  String get dsAccessNote;

  /// No description provided for @dsDisableNow.
  ///
  /// In ar, this message translates to:
  /// **'عطّل الوصول الآن'**
  String get dsDisableNow;

  /// No description provided for @dsEnable.
  ///
  /// In ar, this message translates to:
  /// **'أعد التفعيل'**
  String get dsEnable;

  /// No description provided for @dsArchive.
  ///
  /// In ar, this message translates to:
  /// **'أرشف المجموعة'**
  String get dsArchive;

  /// No description provided for @dsArchiveConfirm.
  ///
  /// In ar, this message translates to:
  /// **'الأرشفة نهائية: يتوقف وصول الطلاب ولا يمكن التراجع.'**
  String get dsArchiveConfirm;

  /// No description provided for @dsArchiveFinal.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد الأرشفة النهائية'**
  String get dsArchiveFinal;

  /// No description provided for @dsCodesAfterPublish.
  ///
  /// In ar, this message translates to:
  /// **'توليد الأكواد متاح بعد نشر المجموعة.'**
  String get dsCodesAfterPublish;

  /// No description provided for @dsCodeCount.
  ///
  /// In ar, this message translates to:
  /// **'عدد الأكواد (كل كود لطالب واحد، حتى 500 في المرة)'**
  String get dsCodeCount;

  /// No description provided for @dsGenerate.
  ///
  /// In ar, this message translates to:
  /// **'ولّد {count} كود'**
  String dsGenerate(int count);

  /// No description provided for @dsFreshCodes.
  ///
  /// In ar, this message translates to:
  /// **'{count} كود جديد — احفظها الآن، لن تظهر كاملة مرة أخرى.'**
  String dsFreshCodes(int count);

  /// No description provided for @dsFreshCodesNote.
  ///
  /// In ar, this message translates to:
  /// **'ملف الأكواد حساس: من يملك الكود يستطيع الدخول. شاركه مع طلابك فقط.'**
  String get dsFreshCodesNote;

  /// No description provided for @dsShareCsv.
  ///
  /// In ar, this message translates to:
  /// **'مشاركة ملف CSV'**
  String get dsShareCsv;

  /// No description provided for @dsCopyAll.
  ///
  /// In ar, this message translates to:
  /// **'نسخ الكل'**
  String get dsCopyAll;

  /// No description provided for @dsHideCodes.
  ///
  /// In ar, this message translates to:
  /// **'حفظتها، أخفِها'**
  String get dsHideCodes;

  /// No description provided for @dsAll.
  ///
  /// In ar, this message translates to:
  /// **'الكل'**
  String get dsAll;

  /// No description provided for @dsUnused.
  ///
  /// In ar, this message translates to:
  /// **'غير مستخدم'**
  String get dsUnused;

  /// No description provided for @dsClaimed.
  ///
  /// In ar, this message translates to:
  /// **'مستخدم'**
  String get dsClaimed;

  /// No description provided for @dsRevokedLabel.
  ///
  /// In ar, this message translates to:
  /// **'ملغى'**
  String get dsRevokedLabel;

  /// No description provided for @dsCodeSearch.
  ///
  /// In ar, this message translates to:
  /// **'آخر 4 أحرف أو @اسم'**
  String get dsCodeSearch;

  /// No description provided for @dsNoCodes.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد أكواد بهذا الفلتر.'**
  String get dsNoCodes;

  /// No description provided for @dsCodeClaimed.
  ///
  /// In ar, this message translates to:
  /// **'مستخدم · {who} · {date}'**
  String dsCodeClaimed(String who, String date);

  /// No description provided for @dsCodeRevoked.
  ///
  /// In ar, this message translates to:
  /// **'ملغى · {date}'**
  String dsCodeRevoked(String date);

  /// No description provided for @dsCodeUnused.
  ///
  /// In ar, this message translates to:
  /// **'غير مستخدم · {date}'**
  String dsCodeUnused(String date);

  /// No description provided for @dsStudent.
  ///
  /// In ar, this message translates to:
  /// **'طالب'**
  String get dsStudent;

  /// No description provided for @dsRevoke.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء'**
  String get dsRevoke;

  /// No description provided for @dsNoStudents.
  ///
  /// In ar, this message translates to:
  /// **'لم يفعّل أي طالب كودًا بعد.'**
  String get dsNoStudents;

  /// No description provided for @dsActive.
  ///
  /// In ar, this message translates to:
  /// **'مفعّل'**
  String get dsActive;

  /// No description provided for @dsWithdrawn.
  ///
  /// In ar, this message translates to:
  /// **'مسحوب'**
  String get dsWithdrawn;

  /// No description provided for @dsWithdraw.
  ///
  /// In ar, this message translates to:
  /// **'اسحب الوصول'**
  String get dsWithdraw;

  /// No description provided for @dsWithdrawConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سيفقد هذا الطالب الوصول للمجموعة فورًا.'**
  String get dsWithdrawConfirm;

  /// No description provided for @dsWithdrawYes.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد السحب'**
  String get dsWithdrawYes;

  /// No description provided for @gamesTitle.
  ///
  /// In ar, this message translates to:
  /// **'🧠 ألعاب الذاكرة'**
  String get gamesTitle;

  /// No description provided for @gamesIntro.
  ///
  /// In ar, this message translates to:
  /// **'درّب عقلك واكسر رقمك القياسي.'**
  String get gamesIntro;

  /// No description provided for @gamesWelcome.
  ///
  /// In ar, this message translates to:
  /// **'أهلًا بك في ألعاب الذاكرة 🧠'**
  String get gamesWelcome;

  /// No description provided for @gamesWelcomeBody.
  ///
  /// In ar, this message translates to:
  /// **'تحدَّ ذاكرتك وسرعتك وتفكيرك المنطقي.'**
  String get gamesWelcomeBody;

  /// No description provided for @gamesStartFirst.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ أول لعبة'**
  String get gamesStartFirst;

  /// No description provided for @gamesStageOf.
  ///
  /// In ar, this message translates to:
  /// **'المستوى {stage}'**
  String gamesStageOf(String stage);

  /// No description provided for @gamesBestScore.
  ///
  /// In ar, this message translates to:
  /// **'أفضل نتيجة {score}'**
  String gamesBestScore(String score);

  /// No description provided for @gamesCompletedStages.
  ///
  /// In ar, this message translates to:
  /// **'المستويات المكتملة'**
  String get gamesCompletedStages;

  /// No description provided for @gamesContinueStage.
  ///
  /// In ar, this message translates to:
  /// **'تابع المستوى {stage}'**
  String gamesContinueStage(int stage);

  /// No description provided for @gamesStartStage1.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ المستوى 1'**
  String get gamesStartStage1;

  /// No description provided for @gamesResumeStage.
  ///
  /// In ar, this message translates to:
  /// **'أكمل المستوى {stage}'**
  String gamesResumeStage(int stage);

  /// No description provided for @gamesReplayStage.
  ///
  /// In ar, this message translates to:
  /// **'أعد لعب المستوى {stage}'**
  String gamesReplayStage(int stage);

  /// No description provided for @gamesPlayStage.
  ///
  /// In ar, this message translates to:
  /// **'العب المستوى {stage}'**
  String gamesPlayStage(int stage);

  /// No description provided for @gamesPrevLevel.
  ///
  /// In ar, this message translates to:
  /// **'المستوى السابق'**
  String get gamesPrevLevel;

  /// No description provided for @gamesNextLevel.
  ///
  /// In ar, this message translates to:
  /// **'المستوى التالي'**
  String get gamesNextLevel;

  /// No description provided for @gamesLevel.
  ///
  /// In ar, this message translates to:
  /// **'المستوى'**
  String get gamesLevel;

  /// No description provided for @gamesLevelN.
  ///
  /// In ar, this message translates to:
  /// **'المستوى {stage}'**
  String gamesLevelN(int stage);

  /// No description provided for @gamesDone.
  ///
  /// In ar, this message translates to:
  /// **'مكتمل'**
  String get gamesDone;

  /// No description provided for @gamesCurrentLevel.
  ///
  /// In ar, this message translates to:
  /// **'مستواك الحالي'**
  String get gamesCurrentLevel;

  /// No description provided for @gamesOpenLevel.
  ///
  /// In ar, this message translates to:
  /// **'مفتوح'**
  String get gamesOpenLevel;

  /// No description provided for @gamesStatBest.
  ///
  /// In ar, this message translates to:
  /// **'أفضل نتيجة'**
  String get gamesStatBest;

  /// No description provided for @gamesStatAccuracy.
  ///
  /// In ar, this message translates to:
  /// **'الدقة'**
  String get gamesStatAccuracy;

  /// No description provided for @gamesStatFastestSolve.
  ///
  /// In ar, this message translates to:
  /// **'أسرع حل'**
  String get gamesStatFastestSolve;

  /// No description provided for @gamesStatFastestAnswer.
  ///
  /// In ar, this message translates to:
  /// **'أسرع إجابة'**
  String get gamesStatFastestAnswer;

  /// No description provided for @gamesOnlineOnly.
  ///
  /// In ar, this message translates to:
  /// **'الألعاب تحتاج اتصالًا بالإنترنت — النتائج تُحسب على الخادم.'**
  String get gamesOnlineOnly;

  /// No description provided for @gamesLocked.
  ///
  /// In ar, this message translates to:
  /// **'هذا المستوى مقفل'**
  String get gamesLocked;

  /// No description provided for @gamesStartFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذر بدء المستوى'**
  String get gamesStartFailed;

  /// No description provided for @gamesBackToLevels.
  ///
  /// In ar, this message translates to:
  /// **'العودة للمستويات'**
  String get gamesBackToLevels;

  /// No description provided for @gamesPreparing.
  ///
  /// In ar, this message translates to:
  /// **'نجهّز المستوى {stage}…'**
  String gamesPreparing(int stage);

  /// No description provided for @gamesReady.
  ///
  /// In ar, this message translates to:
  /// **'جاهز؟'**
  String get gamesReady;

  /// No description provided for @gamesReadyContinue.
  ///
  /// In ar, this message translates to:
  /// **'جاهز تكمل؟'**
  String get gamesReadyContinue;

  /// No description provided for @gamesRuleQuestions.
  ///
  /// In ar, this message translates to:
  /// **'{count} أسئلة'**
  String gamesRuleQuestions(int count);

  /// No description provided for @gamesRuleSeconds.
  ///
  /// In ar, this message translates to:
  /// **'{seconds} ثوانٍ لكل سؤال'**
  String gamesRuleSeconds(int seconds);

  /// No description provided for @gamesRulePass.
  ///
  /// In ar, this message translates to:
  /// **'تحتاج {count} إجابات صحيحة لفتح المستوى التالي'**
  String gamesRulePass(int count);

  /// No description provided for @gamesContinueFrom.
  ///
  /// In ar, this message translates to:
  /// **'▶ أكمل من السؤال {index}'**
  String gamesContinueFrom(int index);

  /// No description provided for @gamesStart.
  ///
  /// In ar, this message translates to:
  /// **'▶ ابدأ'**
  String get gamesStart;

  /// No description provided for @gamesScoring.
  ///
  /// In ar, this message translates to:
  /// **'نحسب نتيجتك…'**
  String get gamesScoring;

  /// No description provided for @gamesOffline.
  ///
  /// In ar, this message translates to:
  /// **'انقطع الاتصال'**
  String get gamesOffline;

  /// No description provided for @gamesOfflineBody.
  ///
  /// In ar, this message translates to:
  /// **'إجاباتك محفوظة على جهازك، وسنرسلها تلقائيًا عند عودة الاتصال.'**
  String get gamesOfflineBody;

  /// No description provided for @gamesExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت هذه الجلسة'**
  String get gamesExpired;

  /// No description provided for @gamesSaveFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذر حفظ النتيجة'**
  String get gamesSaveFailed;

  /// No description provided for @gamesRestartStage.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ المستوى من جديد'**
  String get gamesRestartStage;

  /// No description provided for @gamesQuestionOf.
  ///
  /// In ar, this message translates to:
  /// **'سؤال {position}'**
  String gamesQuestionOf(String position);

  /// No description provided for @gamesPoints.
  ///
  /// In ar, this message translates to:
  /// **'النقاط {points}'**
  String gamesPoints(int points);

  /// No description provided for @gamesTimeLeft.
  ///
  /// In ar, this message translates to:
  /// **'الوقت المتبقي {seconds} ثانية'**
  String gamesTimeLeft(int seconds);

  /// No description provided for @gamesRight.
  ///
  /// In ar, this message translates to:
  /// **'✓ صحيح'**
  String get gamesRight;

  /// No description provided for @gamesWrong.
  ///
  /// In ar, this message translates to:
  /// **'✗ خطأ'**
  String get gamesWrong;

  /// No description provided for @gamesTimeUp.
  ///
  /// In ar, this message translates to:
  /// **'⏱ انتهى الوقت'**
  String get gamesTimeUp;

  /// No description provided for @gamesResult.
  ///
  /// In ar, this message translates to:
  /// **'النتيجة'**
  String get gamesResult;

  /// No description provided for @gamesAllDone.
  ///
  /// In ar, this message translates to:
  /// **'كل المستويات مكتملة!'**
  String get gamesAllDone;

  /// No description provided for @gamesStageDone.
  ///
  /// In ar, this message translates to:
  /// **'أنهيت المستوى {stage}'**
  String gamesStageDone(int stage);

  /// No description provided for @gamesAlmost.
  ///
  /// In ar, this message translates to:
  /// **'قربت! 💪'**
  String get gamesAlmost;

  /// No description provided for @gamesNeedMore.
  ///
  /// In ar, this message translates to:
  /// **'{score} — تحتاج أكثر قليلًا لفتح المستوى التالي'**
  String gamesNeedMore(String score);

  /// No description provided for @gamesScore.
  ///
  /// In ar, this message translates to:
  /// **'النتيجة'**
  String get gamesScore;

  /// No description provided for @gamesCorrect.
  ///
  /// In ar, this message translates to:
  /// **'الصحيح'**
  String get gamesCorrect;

  /// No description provided for @gamesTime.
  ///
  /// In ar, this message translates to:
  /// **'الوقت'**
  String get gamesTime;

  /// No description provided for @gamesHints.
  ///
  /// In ar, this message translates to:
  /// **'التلميحات'**
  String get gamesHints;

  /// No description provided for @gamesNewBest.
  ///
  /// In ar, this message translates to:
  /// **'⭐ رقم قياسي جديد لهذا المستوى!'**
  String get gamesNewBest;

  /// No description provided for @gamesUnlocked.
  ///
  /// In ar, this message translates to:
  /// **'🔓 انفتح المستوى {stage}'**
  String gamesUnlocked(int stage);

  /// No description provided for @gamesNextStage.
  ///
  /// In ar, this message translates to:
  /// **'المستوى التالي'**
  String get gamesNextStage;

  /// No description provided for @gamesRetry.
  ///
  /// In ar, this message translates to:
  /// **'أعد المحاولة'**
  String get gamesRetry;

  /// No description provided for @gamesTryAgain.
  ///
  /// In ar, this message translates to:
  /// **'حاول مرة ثانية'**
  String get gamesTryAgain;

  /// No description provided for @gamesBackToGames.
  ///
  /// In ar, this message translates to:
  /// **'العودة للألعاب'**
  String get gamesBackToGames;

  /// No description provided for @gamesMistakes.
  ///
  /// In ar, this message translates to:
  /// **'الأخطاء {count}'**
  String gamesMistakes(int count);

  /// No description provided for @gamesSudokuOffline.
  ///
  /// In ar, this message translates to:
  /// **'انقطع الاتصال — حلك محفوظ وسنرسله عند عودة الاتصال.'**
  String get gamesSudokuOffline;

  /// No description provided for @gamesChecking.
  ///
  /// In ar, this message translates to:
  /// **'نتحقق من الحل…'**
  String get gamesChecking;

  /// No description provided for @gamesUndo.
  ///
  /// In ar, this message translates to:
  /// **'تراجع'**
  String get gamesUndo;

  /// No description provided for @gamesErase.
  ///
  /// In ar, this message translates to:
  /// **'مسح'**
  String get gamesErase;

  /// No description provided for @gamesNotes.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظات'**
  String get gamesNotes;

  /// No description provided for @gamesHint.
  ///
  /// In ar, this message translates to:
  /// **'تلميح ({left})'**
  String gamesHint(int left);

  /// No description provided for @gamesDigit.
  ///
  /// In ar, this message translates to:
  /// **'{digit} — متبقٍ {left}'**
  String gamesDigit(int digit, int left);

  /// No description provided for @gamesCell.
  ///
  /// In ar, this message translates to:
  /// **'صف {row} عمود {col}: {value}'**
  String gamesCell(int row, int col, String value);

  /// No description provided for @gamesEmptyCell.
  ///
  /// In ar, this message translates to:
  /// **'فارغة'**
  String get gamesEmptyCell;

  /// No description provided for @shIntro.
  ///
  /// In ar, this message translates to:
  /// **'ملفات دراسية جاهزة شاركها معك زملاؤك — تقدّمك فيها خاص بك.'**
  String get shIntro;

  /// No description provided for @shTabRequests.
  ///
  /// In ar, this message translates to:
  /// **'الطلبات'**
  String get shTabRequests;

  /// No description provided for @shTabNotifications.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات'**
  String get shTabNotifications;

  /// No description provided for @shNoRequests.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد طلبات جديدة'**
  String get shNoRequests;

  /// No description provided for @shNoRequestsHint.
  ///
  /// In ar, this message translates to:
  /// **'عندما يشارك زميل ملفًا معك سيظهر طلبه هنا.'**
  String get shNoRequestsHint;

  /// No description provided for @shNoPacks.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد ملفات مشتركة بعد'**
  String get shNoPacks;

  /// No description provided for @shNoPacksHint.
  ///
  /// In ar, this message translates to:
  /// **'الملفات التي تقبلها تظهر هنا وتفتح بنفس أدوات الدراسة.'**
  String get shNoPacksHint;

  /// No description provided for @shNoNotifications.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد إشعارات'**
  String get shNoNotifications;

  /// No description provided for @shWantsToShare.
  ///
  /// In ar, this message translates to:
  /// **'{who} يريد مشاركة ملف معك'**
  String shWantsToShare(String who);

  /// No description provided for @shPages.
  ///
  /// In ar, this message translates to:
  /// **'{count} صفحة'**
  String shPages(int count);

  /// No description provided for @shAccept.
  ///
  /// In ar, this message translates to:
  /// **'قبول'**
  String get shAccept;

  /// No description provided for @shDecline.
  ///
  /// In ar, this message translates to:
  /// **'رفض'**
  String get shDecline;

  /// No description provided for @shDeclineBlock.
  ///
  /// In ar, this message translates to:
  /// **'رفض وحظر'**
  String get shDeclineBlock;

  /// No description provided for @shBlockTitle.
  ///
  /// In ar, this message translates to:
  /// **'رفض وحظر'**
  String get shBlockTitle;

  /// No description provided for @shBlockConfirm.
  ///
  /// In ar, this message translates to:
  /// **'رفض الطلب وحظر {who}؟ لن يتمكن من إيجادك أو مشاركة ملفات معك.'**
  String shBlockConfirm(String who);

  /// No description provided for @shChapters.
  ///
  /// In ar, this message translates to:
  /// **'{count} أجزاء ملخّصة'**
  String shChapters(int count);

  /// No description provided for @shCards.
  ///
  /// In ar, this message translates to:
  /// **'{count} بطاقة'**
  String shCards(int count);

  /// No description provided for @shMindMap.
  ///
  /// In ar, this message translates to:
  /// **'خريطة ذهنية'**
  String get shMindMap;

  /// No description provided for @shNoContentYet.
  ///
  /// In ar, this message translates to:
  /// **'الملف جاهز للقراءة، ولم يُولَّد محتوى بعد.'**
  String get shNoContentYet;

  /// No description provided for @shFrom.
  ///
  /// In ar, this message translates to:
  /// **'من {who}'**
  String shFrom(String who);

  /// No description provided for @shNoteRequest.
  ///
  /// In ar, this message translates to:
  /// **'{who} أرسل لك طلب مشاركة «{title}»'**
  String shNoteRequest(String who, String title);

  /// No description provided for @shNoteAccepted.
  ///
  /// In ar, this message translates to:
  /// **'{who} قبل ملفك «{title}»'**
  String shNoteAccepted(String who, String title);

  /// No description provided for @shNoteDeclined.
  ///
  /// In ar, this message translates to:
  /// **'{who} رفض طلب مشاركة «{title}»'**
  String shNoteDeclined(String who, String title);

  /// No description provided for @shUsernameTitle.
  ///
  /// In ar, this message translates to:
  /// **'اسم المستخدم للمشاركة'**
  String get shUsernameTitle;

  /// No description provided for @shUsernameSet.
  ///
  /// In ar, this message translates to:
  /// **'يجدك زملاؤك بهذا الاسم ليشاركوا معك ملفاتهم. بريدك الإلكتروني لا يظهر لأحد.'**
  String get shUsernameSet;

  /// No description provided for @shUsernameUnset.
  ///
  /// In ar, this message translates to:
  /// **'اختر اسم مستخدم ليتمكن زملاؤك من إيجادك ومشاركة ملفاتهم معك. بريدك الإلكتروني لا يظهر لأحد.'**
  String get shUsernameUnset;

  /// No description provided for @shUsernameRule.
  ///
  /// In ar, this message translates to:
  /// **'من 3 إلى 24 حرفًا: أحرف إنجليزية صغيرة وأرقام و . و _'**
  String get shUsernameRule;

  /// No description provided for @shChoose.
  ///
  /// In ar, this message translates to:
  /// **'اختيار'**
  String get shChoose;

  /// No description provided for @shShare.
  ///
  /// In ar, this message translates to:
  /// **'مشاركة'**
  String get shShare;

  /// No description provided for @shShareTitle.
  ///
  /// In ar, this message translates to:
  /// **'مشاركة الملف مع طالب'**
  String get shShareTitle;

  /// No description provided for @shSearchHint.
  ///
  /// In ar, this message translates to:
  /// **'ابحث باسم المستخدم أو الاسم'**
  String get shSearchHint;

  /// No description provided for @shSearchRule.
  ///
  /// In ar, this message translates to:
  /// **'اكتب حرفين على الأقل. يظهر فقط الطلاب الذين اختاروا اسم مستخدم.'**
  String get shSearchRule;

  /// No description provided for @shNoStudent.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد طالب بهذا الاسم.'**
  String get shNoStudent;

  /// No description provided for @shMoreResults.
  ///
  /// In ar, this message translates to:
  /// **'نتائج أكثر'**
  String get shMoreResults;

  /// No description provided for @shFirstResults.
  ///
  /// In ar, this message translates to:
  /// **'العودة لأول النتائج'**
  String get shFirstResults;

  /// No description provided for @shExplain.
  ///
  /// In ar, this message translates to:
  /// **'سيحصل على نفس المحتوى الجاهز: الملخص، البطاقات، الأسئلة، الخريطة الذهنية و Exam Focus — بدون إعادة توليد، وبدون تقدّمك أو ملاحظاتك الشخصية.'**
  String get shExplain;

  /// No description provided for @shSendRequest.
  ///
  /// In ar, this message translates to:
  /// **'إرسال طلب المشاركة'**
  String get shSendRequest;

  /// No description provided for @shBack.
  ///
  /// In ar, this message translates to:
  /// **'رجوع'**
  String get shBack;

  /// No description provided for @shSent.
  ///
  /// In ar, this message translates to:
  /// **'✓ تم إرسال الطلب'**
  String get shSent;

  /// No description provided for @shSentBody.
  ///
  /// In ar, this message translates to:
  /// **'سيظهر الملف عند {who} بعد قبوله الطلب.'**
  String shSentBody(String who);

  /// No description provided for @shShareAnother.
  ///
  /// In ar, this message translates to:
  /// **'مشاركة مع طالب آخر'**
  String get shShareAnother;

  /// No description provided for @shSharedWith.
  ///
  /// In ar, this message translates to:
  /// **'تمت المشاركة مع'**
  String get shSharedWith;

  /// No description provided for @shNotSharedYet.
  ///
  /// In ar, this message translates to:
  /// **'لم تشارك هذا الملف مع أحد بعد.'**
  String get shNotSharedYet;

  /// No description provided for @shPending.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار الرد'**
  String get shPending;

  /// No description provided for @shHasAccess.
  ///
  /// In ar, this message translates to:
  /// **'لديه وصول'**
  String get shHasAccess;

  /// No description provided for @shDeclined.
  ///
  /// In ar, this message translates to:
  /// **'رفض الطلب'**
  String get shDeclined;

  /// No description provided for @shWithdraw.
  ///
  /// In ar, this message translates to:
  /// **'سحب'**
  String get shWithdraw;

  /// No description provided for @shRemoveAccess.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء الوصول'**
  String get shRemoveAccess;

  /// No description provided for @shWithdrawConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سحب طلب المشاركة المرسل إلى {who}؟'**
  String shWithdrawConfirm(String who);

  /// No description provided for @shRemoveAccessConfirm.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء وصول {who} لهذا الملف؟ سيختفي من مكتبته فورًا.'**
  String shRemoveAccessConfirm(String who);

  /// No description provided for @shBlockedTitle.
  ///
  /// In ar, this message translates to:
  /// **'المحظورون'**
  String get shBlockedTitle;

  /// No description provided for @shBlockedEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لم تحظر أحدًا'**
  String get shBlockedEmpty;

  /// No description provided for @shBlockedHint.
  ///
  /// In ar, this message translates to:
  /// **'المحظور لا يستطيع إيجادك أو مشاركة ملفات معك.'**
  String get shBlockedHint;

  /// No description provided for @shUnblock.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء الحظر'**
  String get shUnblock;

  /// No description provided for @shUnblockConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سيتمكن من إيجادك وإرسال طلبات مشاركة مجددًا.'**
  String get shUnblockConfirm;
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
