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
