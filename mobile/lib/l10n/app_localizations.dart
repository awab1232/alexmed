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

  /// No description provided for @flashSourceTitle.
  ///
  /// In ar, this message translates to:
  /// **'مصدر السؤال — صفحة {page}'**
  String flashSourceTitle(int page);

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

  /// No description provided for @sourceImageFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذر تحميل صورة هذه الصفحة.'**
  String get sourceImageFailed;

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
