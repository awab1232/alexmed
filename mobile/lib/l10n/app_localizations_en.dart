// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'NiroLearn';

  @override
  String get tabHome => 'Home';

  @override
  String get tabGames => 'Games';

  @override
  String get tabAdd => 'Add';

  @override
  String get tabNiro => 'Niro';

  @override
  String get tabAccount => 'Account';

  @override
  String get actionRetry => 'Try again';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionConfirm => 'Confirm';

  @override
  String get actionClose => 'Close';

  @override
  String get actionSave => 'Save';

  @override
  String get actionContinue => 'Continue';

  @override
  String get loading => 'Loading…';

  @override
  String get offlineBanner =>
      'You\'re offline — showing what\'s saved on this device.';

  @override
  String get emptyTitle => 'Nothing here yet';

  @override
  String get errorTitle => 'Couldn\'t load this';

  @override
  String get errorNetwork =>
      'Couldn\'t connect. Check your internet and try again.';

  @override
  String get errorSessionExpired => 'Your session ended. Please sign in again.';

  @override
  String get errorForbidden => 'You don\'t have access to this content.';

  @override
  String get errorNotFound => 'Not available.';

  @override
  String get errorRateLimited =>
      'Too many attempts. Wait a moment and try again.';

  @override
  String get errorServer =>
      'Something went wrong on our side. Try again shortly.';

  @override
  String get errorRejected => 'This couldn\'t be done.';

  @override
  String underConstruction(String phase) {
    return 'Under construction — $phase';
  }

  @override
  String get welcomeTitle => 'Welcome';

  @override
  String get welcomeHeadline => 'Study smarter with Niro';

  @override
  String get welcomeBody =>
      'Upload a file and we turn it into a summary, flashcards and quizzes.';

  @override
  String get welcomeSignIn => 'Sign in';

  @override
  String get welcomeCreateAccount => 'Create account';

  @override
  String get loginTitle => 'Sign in';

  @override
  String get loginSubtitle => 'Welcome back to NiroLearn';

  @override
  String get loginIdentifier => 'Phone number or email';

  @override
  String get loginPassword => 'Password';

  @override
  String get loginSubmit => 'Sign in';

  @override
  String get loginSubmitting => 'Signing in...';

  @override
  String get loginNoAccount => 'No account yet?';

  @override
  String get loginCreateAccount => 'Create one';

  @override
  String get loginFillBoth =>
      'Enter your phone number (or email) and password.';

  @override
  String get showPassword => 'Show password';

  @override
  String get hidePassword => 'Hide password';

  @override
  String get sessionEndedNotice => 'Your session ended. Please sign in again.';

  @override
  String get registerTitle => 'Create account';

  @override
  String get registerPhoneStep => 'Your phone number';

  @override
  String get registerPhoneHint =>
      'We\'ll text you a code to confirm the number.';

  @override
  String get registerCountry => 'Country';

  @override
  String get registerPhone => 'Mobile number';

  @override
  String get registerSendCode => 'Send code';

  @override
  String get registerInvalidPhone =>
      'That phone number isn\'t valid. Check the number and the country.';

  @override
  String get registerCodeStep => 'Enter the code';

  @override
  String registerCodeSentTo(String phone) {
    return 'We sent a 6-digit code to $phone';
  }

  @override
  String get registerCode => 'Code';

  @override
  String get registerVerify => 'Confirm';

  @override
  String get registerResend => 'Send a new code';

  @override
  String registerResendIn(int seconds) {
    return 'Resend in ${seconds}s';
  }

  @override
  String get registerChangePhone => 'Change number';

  @override
  String get registerDetailsStep => 'Your details';

  @override
  String get registerName => 'Name';

  @override
  String get registerNameError => 'Enter your name (at least 2 letters).';

  @override
  String get registerPasswordError => 'Password must be at least 8 characters.';

  @override
  String get registerSubmit => 'Create account';

  @override
  String get registerHaveAccount => 'Already have an account?';

  @override
  String get registerTerms =>
      'By creating an account you agree to the Terms of Use and Privacy Policy.';

  @override
  String get greetingNight => 'Late-night study';

  @override
  String get greetingMorning => 'Good morning';

  @override
  String get greetingEvening => 'Good evening';

  @override
  String greetingWithName(String greeting, String name) {
    return '$greeting, $name';
  }

  @override
  String nextDueTitle(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count cards ready for review',
      one: '1 card ready for review',
    );
    return '$_temp0';
  }

  @override
  String nextDueDetail(int minutes) {
    return 'About $minutes min — reviewing on time makes it stick.';
  }

  @override
  String get nextDueAction => 'Start review';

  @override
  String nextPreparingTitle(String title) {
    return 'Preparing “$title”';
  }

  @override
  String get nextPreparingDetail =>
      'We\'re reading the pages and splitting them into chapters. You can open it and follow along.';

  @override
  String get nextOpenBook => 'Open book';

  @override
  String nextContinueTitle(String title) {
    return 'Continue “$title”';
  }

  @override
  String get nextContinueDetail =>
      'Nothing is due right now. Pick up where you left off.';

  @override
  String get nextContinueAction => 'Continue studying';

  @override
  String get nextFirstTitle => 'Upload your first book';

  @override
  String get nextFirstDetail =>
      'A PDF from your course is enough. We turn it into cards, questions, a summary and a mind map.';

  @override
  String get nextFirstAction => 'Upload a book';

  @override
  String examIn(String name, String when) {
    return '$name exam $when';
  }

  @override
  String get daysToday => 'today';

  @override
  String get daysTomorrow => 'tomorrow';

  @override
  String get daysTwo => 'in 2 days';

  @override
  String daysFew(int days) {
    return 'in $days days';
  }

  @override
  String daysMany(int days) {
    return 'in $days days';
  }

  @override
  String get yourBooks => 'Your books';

  @override
  String get bookReady => 'Ready to study';

  @override
  String bookPartsReady(int done, int total) {
    return '$done of $total parts ready';
  }

  @override
  String get bookPreparing => 'Preparing study tools…';

  @override
  String get bookReading => 'Reading the pages…';

  @override
  String sharedPending(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'You have $count new share requests',
      one: 'You have a new share request',
    );
    return '$_temp0';
  }

  @override
  String get sharedPendingDetail =>
      'A classmate wants to share a study pack with you';

  @override
  String get sharedWithMe => 'Shared with me';

  @override
  String get sharedWithMeDetail => 'Files your classmates shared with you';

  @override
  String sharedFrom(String owner) {
    return 'Shared by $owner';
  }

  @override
  String get sharedColleague => 'a classmate';

  @override
  String get myFolders => 'My folders';

  @override
  String get newFolder => 'New folder';

  @override
  String get foldersEmpty =>
      'No folders yet. A folder groups one subject\'s books and question files.';

  @override
  String get createFolder => 'Create a folder';

  @override
  String folderBooks(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count books',
      one: '1 book',
    );
    return '$_temp0';
  }

  @override
  String folderDecks(int count) {
    return ', $count question files';
  }

  @override
  String folderUpdated(String date) {
    return ', updated $date';
  }

  @override
  String get searchFolders => 'Search folders...';

  @override
  String get noMatches => 'No matches';

  @override
  String get noMatchesDetail => 'Try another name.';

  @override
  String get folderName => 'Folder name';

  @override
  String get folderNameHint => 'e.g. Anatomy, Maths 1';

  @override
  String get folderType => 'Subject type';

  @override
  String get folderCreate => 'Create';

  @override
  String get folderCreateError =>
      'Couldn\'t create the folder. Check the name and try again.';

  @override
  String get folderLoadError => 'Couldn\'t load your files';

  @override
  String get folderEmpty => 'No files in this folder yet';

  @override
  String get addFile => 'Add a file';

  @override
  String folderSummary(String type, int count) {
    return '$type · $count files';
  }

  @override
  String get questionFilesSection => 'Question files';

  @override
  String get questionFileBadge => 'Question file';

  @override
  String deckMeta(int cards, int pages) {
    return '$cards cards · $pages pages';
  }

  @override
  String bookMeta(int pages) {
    return '$pages pages';
  }

  @override
  String get moveTo => 'Move to folder';

  @override
  String get noFolder => 'No subject';

  @override
  String get moved => 'Moved.';

  @override
  String get renameFolder => 'Rename';

  @override
  String get deleteFolder => 'Delete folder';

  @override
  String get deleteFolderTitle => 'Delete this folder?';

  @override
  String get deleteFolderBody =>
      'Only the folder is deleted. Its books and question files stay in your account without a subject.';

  @override
  String get folderActions => 'Folder options';

  @override
  String get saved => 'Saved.';

  @override
  String get addSheetTitle => 'What do you want to add?';

  @override
  String get addBook => 'Study book';

  @override
  String get addBookDetail =>
      'Chapters, explanations, cards, quizzes and a summary per chapter.';

  @override
  String get addQuestionFile => 'Question file';

  @override
  String get addQuestionFileDetail =>
      'Turn a question file into quick study cards.';

  @override
  String get addFolderDetail => 'Organise your files by subject.';

  @override
  String get addDoctorCode => 'Code from your doctor';

  @override
  String get addDoctorCodeDetail =>
      'Add a protected question set with an access code.';

  @override
  String get accountGroup => 'Account';

  @override
  String get studyGroup => 'My study';

  @override
  String get adminGroup => 'Management';

  @override
  String get helpGroup => 'Help';

  @override
  String get studyProfile => 'Study profile';

  @override
  String get studyProfileEmpty => 'Add your specialty and year';

  @override
  String get academicYear => 'Academic year';

  @override
  String get academicYearHint => 'e.g. Third year';

  @override
  String get specialty => 'Specialty';

  @override
  String get specialtyHint => 'e.g. Medicine';

  @override
  String get usernameRow => 'Username for sharing';

  @override
  String get usernameEmpty => 'Not chosen yet';

  @override
  String get planRow => 'Plan and usage';

  @override
  String get questionFilesRow => 'Question files';

  @override
  String get statsRow => 'My statistics';

  @override
  String get doctorDashboard => 'Doctor dashboard';

  @override
  String get doctorApply => 'Join as a doctor';

  @override
  String get doctorPending => 'Doctor application under review';

  @override
  String get doctorRejected => 'Doctor application not accepted';

  @override
  String get doctorSuspended => 'Doctor access suspended';

  @override
  String get privacyPolicy => 'Privacy policy';

  @override
  String get termsOfUse => 'Terms of use';

  @override
  String get contactUs => 'Contact us';

  @override
  String get signOut => 'Sign out';

  @override
  String get signOutConfirmTitle => 'Sign out?';

  @override
  String get signOutConfirmBody =>
      'You\'ll need to sign in again on this device.';

  @override
  String get deleteAccount => 'Delete account';

  @override
  String get deleteAccountTitle => 'Delete your account permanently?';

  @override
  String get deleteAccountBody =>
      'Your account is deleted with all your files and their images, summaries, cards and questions, your progress, chats and shares. This can\'t be undone.';

  @override
  String get deleteAccountTypeWord => 'To confirm, type the word «حذف»';

  @override
  String get deleteAccountConfirmWord => 'حذف';

  @override
  String get deleteAccountSubmit => 'Delete permanently';

  @override
  String get planTitle => 'Your NiroLearn plan';

  @override
  String get planFree => 'You\'re on the free plan.';

  @override
  String planActiveUntil(String date) {
    return 'Active until $date';
  }

  @override
  String get planActive => 'Active';

  @override
  String get usageAssistant => 'Niro assistant';

  @override
  String get usageQuestionFiles => 'Question files';

  @override
  String get usageStudyFiles => 'Study files';

  @override
  String get usageToday => 'Today';

  @override
  String usageOf(int used, int limit) {
    return '$used of $limit';
  }

  @override
  String get usageUnlimited => 'Unlimited';

  @override
  String get usageResets => 'Resets tomorrow';

  @override
  String maxFileSize(int mb) {
    return 'Max file size: $mb MB';
  }

  @override
  String get openInBrowserFailed => 'Couldn\'t open the page.';

  @override
  String get mirrorTitle => 'Question file → cards';

  @override
  String get mirrorIntro =>
      'Upload your questions and we turn them into cards: question, answer, explanation and keyword — in Arabic and English.';

  @override
  String get mirrorModePdf => 'PDF file';

  @override
  String get mirrorModeText => 'Paste questions';

  @override
  String get mirrorStepFile => 'File';

  @override
  String get mirrorStepText => 'Questions';

  @override
  String get mirrorStepDepth => 'Explanation depth';

  @override
  String get mirrorStepFolder => 'Folder';

  @override
  String get mirrorPickFile => 'Choose a PDF';

  @override
  String get mirrorPickHint => 'Large and scanned PDFs (OCR) are supported.';

  @override
  String mirrorFileReady(String size) {
    return '$size · ready to analyse';
  }

  @override
  String get mirrorChangeFile => 'Change';

  @override
  String mirrorMaxSize(int mb) {
    return 'Your plan allows up to $mb MB';
  }

  @override
  String get depthQuick => 'Quick';

  @override
  String get depthQuickCaption => 'Fast review';

  @override
  String get depthBalanced => 'Balanced';

  @override
  String get depthBalancedCaption => 'Best for exams';

  @override
  String get depthDetailed => 'Detailed';

  @override
  String get depthDetailedCaption => 'Deeper explanations';

  @override
  String get depthRecommended => 'Recommended';

  @override
  String get mirrorChooseFolder => 'Choose a folder';

  @override
  String get mirrorNoFolders => 'No folders yet — create one.';

  @override
  String get mirrorTextHint =>
      'Paste the questions here, with options and answers if you have them…';

  @override
  String mirrorTextCount(int count) {
    return '$count characters';
  }

  @override
  String get mirrorTextTooShort =>
      'Paste the questions first (text too short).';

  @override
  String get mirrorTextTooLong =>
      'The text is over 60,000 characters. Split it in two and add the second part to the same file.';

  @override
  String get mirrorTextDestination => 'Where should the cards go?';

  @override
  String get mirrorTextNewFile => 'New file';

  @override
  String get mirrorTextAppend => 'Add to an existing file';

  @override
  String get mirrorTextTitle => 'File name (optional)';

  @override
  String get mirrorTextTitleHint => 'e.g. Chapter 3 questions';

  @override
  String get mirrorChooseDeck => 'Choose the file';

  @override
  String get mirrorSubmit => 'Turn into cards';

  @override
  String mirrorUploading(int percent) {
    return 'Uploading… $percent%';
  }

  @override
  String get mirrorStarting => 'Preparing the file…';

  @override
  String get mirrorCancelUpload => 'Cancel upload';

  @override
  String get mirrorDisclaimer =>
      'A study aid, not a replacement for your course material. Check the cards marked for review.';

  @override
  String get mirrorJobReading => 'Reading your file…';

  @override
  String get mirrorJobReadingHint =>
      'Scanned files take a little longer. You can leave and come back without losing progress.';

  @override
  String get mirrorJobGenerating => 'Preparing your cards';

  @override
  String mirrorJobProgress(int done, int total) {
    return '$done of $total parts done';
  }

  @override
  String mirrorJobMeta(int pages, int batches) {
    return '$pages pages · $batches parts';
  }

  @override
  String get mirrorStartStudying => 'Start studying';

  @override
  String get mirrorStartEarly =>
      'The first cards are ready — start now, the rest arrive automatically.';

  @override
  String get mirrorJobComplete => 'All done.';

  @override
  String get mirrorJobFailed =>
      'We couldn\'t read this file. Try uploading another copy of it.';

  @override
  String get mirrorRetryPages => 'Retry the failed pages';

  @override
  String mirrorPartial(int count) {
    return 'Most of the file is done, but $count parts couldn\'t be generated.';
  }

  @override
  String mirrorBatchPages(int from, int to) {
    return 'Pages $from–$to';
  }

  @override
  String get mirrorBatchFailed => 'Generation failed';

  @override
  String get mirrorUploadNew => 'Upload a new file';

  @override
  String deckCardOf(int index, int total) {
    return 'Card $index of $total';
  }

  @override
  String get deckAll => 'All';

  @override
  String get deckNeedsReview => 'Needs review';

  @override
  String get deckSearch => 'Search questions or keywords…';

  @override
  String get deckEmpty => 'No cards here';

  @override
  String get deckEmptyHint => 'Try clearing the search or filter.';

  @override
  String get deckWaiting => 'Preparing the first cards…';

  @override
  String deckLive(int count) {
    return 'More on the way — $count cards ready so far.';
  }

  @override
  String get deckAllReady => 'All cards are ready.';

  @override
  String deckFailedParts(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count parts of the file couldn\'t be generated.',
      one: 'One part of the file couldn\'t be generated.',
    );
    return '$_temp0';
  }

  @override
  String get deckDetails => 'Details';

  @override
  String get deckPrevious => 'Previous';

  @override
  String get deckNext => 'Next';

  @override
  String get deckAddQuestions => 'Add questions';

  @override
  String get deckDelete => 'Delete file';

  @override
  String get deckDeleteTitle => 'Delete this question file?';

  @override
  String get deckDeleteBody => 'All of its cards are deleted permanently.';

  @override
  String get deckMore => 'File options';

  @override
  String cardPage(int page) {
    return 'Page $page';
  }

  @override
  String get cardClear => 'Clear';

  @override
  String cardConfidence(String level) {
    return '$level confidence';
  }

  @override
  String get confidenceHigh => 'High';

  @override
  String get confidenceMedium => 'Medium';

  @override
  String get confidenceLow => 'Low';

  @override
  String get cardReveal => 'Show answer & explanation';

  @override
  String get cardCorrect => 'Correct';

  @override
  String get cardWrong => 'Not quite';

  @override
  String get cardAnswer => 'Answer';

  @override
  String get cardExplanation => 'Explanation';

  @override
  String get cardKeyIdea => 'Key idea';

  @override
  String get cardKeyword => 'Keyword';

  @override
  String get cardShowTranslation => 'Show translation';

  @override
  String get cardHideTranslation => 'Hide translation';

  @override
  String get cardTryAgain => 'Try again';

  @override
  String get cardImageFailed => 'Couldn\'t load the image';

  @override
  String get questionFilesTitle => 'Question files';

  @override
  String get questionFilesEmpty => 'No question files yet';

  @override
  String get questionFilesEmptyHint =>
      'Upload your first file and it appears here once generated.';

  @override
  String get questionFilesNew => 'New file';
}
