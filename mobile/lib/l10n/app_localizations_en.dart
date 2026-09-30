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
  String mirrorBatchPages(String range) {
    return 'Pages $range';
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

  @override
  String get bookUploadTitle => 'Upload a study book';

  @override
  String get bookUploadIntro =>
      'Upload your book, whatever its size. We split it into small parts and analyse each one.';

  @override
  String get bookStepFile => 'The book';

  @override
  String get bookStepProfile => 'Subject type';

  @override
  String get bookProfileHint => 'Tunes the analysis to your subject.';

  @override
  String get bookSubmit => 'Split into chapters';

  @override
  String get bookStarting => 'Preparing the book…';

  @override
  String get bookKeepOpen =>
      'Keep the app open until the upload finishes — after that the server carries on.';

  @override
  String bookQuotaLeft(int remaining, int limit) {
    return '$remaining of $limit study files left today';
  }

  @override
  String get bookDuplicateTitle => 'You already have a file with this name';

  @override
  String bookDuplicateBody(String title) {
    return '“$title” is already in your library. Open it instead, or upload this as a new copy.';
  }

  @override
  String get bookDuplicateOpen => 'Open it';

  @override
  String bookMetaParts(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count parts',
      one: '1 part',
    );
    return '$_temp0';
  }

  @override
  String get bookStudyTitle => 'Study this book';

  @override
  String get bookToolsAfterReading =>
      'Study tools appear here once we finish reading the pages.';

  @override
  String get bookGenerateBody =>
      'Prepare cards, questions, summary and mind map for this book in one tap. You can leave the app; it carries on by itself.';

  @override
  String get bookGenerate => 'Prepare study tools';

  @override
  String get bookGenerateError =>
      'Couldn\'t start. Check your connection and try again.';

  @override
  String get bookSharedNotStarted =>
      'The owner hasn\'t prepared this file yet.';

  @override
  String bookSharedFrom(String name) {
    return 'Shared by $name';
  }

  @override
  String get toolCards => 'Flashcards';

  @override
  String get toolCardsPurpose =>
      'Memorise with spaced repetition, card by card';

  @override
  String toolCardsCount(int count) {
    return '$count cards';
  }

  @override
  String get toolMcqs => 'Quiz';

  @override
  String get toolMcqsPurpose => 'Multiple-choice questions, like the exam';

  @override
  String toolMcqsCount(int count) {
    return '$count questions';
  }

  @override
  String get toolSummary => 'Summary';

  @override
  String get toolSummaryPurpose => 'The full explanation, laid out for reading';

  @override
  String get toolMindmap => 'Mind map';

  @override
  String get toolMindmapPurpose => 'How the ideas connect';

  @override
  String get toolMatch => 'Match game';

  @override
  String get toolMatchPurpose =>
      'Match each question to its answer before time runs out';

  @override
  String get toolPreparing => 'Preparing';

  @override
  String get toolLocked => 'Not ready yet';

  @override
  String get examFocusHeadline => 'What the exam asks most from this book';

  @override
  String examFocusReadyCount(int count) {
    return '$count key facts, ranked by importance';
  }

  @override
  String get examFocusBusy => 'Analysing the book for the key facts…';

  @override
  String get examFocusIdle =>
      'We pull out the facts exams keep asking and rank them';

  @override
  String get examFocusOpen => 'Open Exam Focus';

  @override
  String get examFocusPrepare => 'Prepare Exam Focus';

  @override
  String get examFocusSharedMissing => 'The owner hasn\'t made one yet';

  @override
  String get bookSource => 'Original file';

  @override
  String bookSourceMeta(int pages, String date) {
    return '$pages pages, uploaded $date';
  }

  @override
  String get bookSourceView => 'View';

  @override
  String get bookProcessing => 'Processing details';

  @override
  String get bookProcessingDone => 'Complete';

  @override
  String get statVisualDone => 'Pages visually processed';

  @override
  String get statWithVisuals => 'Pages with images or diagrams';

  @override
  String get statNeedsReview => 'Need review';

  @override
  String get statFailed => 'Pages that failed';

  @override
  String coverageLine(int coverage, int done, int total) {
    return 'Processing coverage $coverage% ($done of $total pages)';
  }

  @override
  String coverageMissing(String pages) {
    return 'Pages still to process: $pages';
  }

  @override
  String coverageFailed(String pages) {
    return 'Failed pages: $pages';
  }

  @override
  String get bookLeaveHint =>
      'You can leave and come back later from any device; no progress is lost.';

  @override
  String get stageReading => 'Reading the pages';

  @override
  String get stageChapters =>
      'Analysing chapters (explanation, cards, questions)';

  @override
  String get stageWaiting => 'Waiting for you';

  @override
  String get stageVisuals => 'Extracting images and diagrams';

  @override
  String get stageCoverage => 'Checking full coverage';

  @override
  String stageFraction(int done, int total) {
    return '$done/$total';
  }

  @override
  String get bookFailedDefault =>
      'We couldn\'t read this book. Try again, or upload another copy.';

  @override
  String get bookRetryExtraction => 'Retry reading';

  @override
  String get bookUploadAnother => 'Upload another book';

  @override
  String bookPartialChapters(int count) {
    return 'Most of the book is done, but $count chapter(s) couldn\'t be analysed. You can retry below.';
  }

  @override
  String bookPartialChaptersPages(int chapters, int pages) {
    return 'Most of the book is done, but $chapters chapter(s) couldn\'t be analysed and $pages page(s) couldn\'t be read. You can retry below.';
  }

  @override
  String get bookLowConfidence =>
      'We estimated how the book splits into chapters. Check the chapter names and page ranges.';

  @override
  String pageNumber(int page) {
    return 'Page $page';
  }

  @override
  String get pageTextFailedDefault => 'This page couldn\'t be read (OCR)';

  @override
  String get chapterAnalyzing => 'Analysing…';

  @override
  String get chapterFailedDefault => 'Analysis failed';

  @override
  String get bookNotFound => 'This book couldn\'t be found';

  @override
  String get uploadLeaveTitle => 'Stop the upload?';

  @override
  String get uploadLeaveBody =>
      'The file hasn\'t finished uploading. Leaving now stops it and you\'ll need to start again.';

  @override
  String get uploadLeaveConfirm => 'Stop and leave';

  @override
  String studyCoverageRead(int read, int total) {
    return 'Read $read/$total pages';
  }

  @override
  String studyCoverageAnalyzed(int done, int total) {
    return 'Analysed $done/$total parts';
  }

  @override
  String studyCoverageChunks(int covered, int required) {
    return 'Coverage $covered/$required sections';
  }

  @override
  String studyCoverageFailedPages(String pages) {
    return 'Unreadable pages $pages';
  }

  @override
  String studyCoverageGenFailed(String titles) {
    return 'Generation failed for: $titles';
  }

  @override
  String get studyKnowledgeTitle => 'Collecting every fact in the file first';

  @override
  String get studyKnowledgeBodyCards =>
      'Cards are built from one knowledge base covering every page — the same facts as Exam Focus.';

  @override
  String get studyKnowledgeBodyMcqs =>
      'Questions are built from one knowledge base covering every page — the same facts as Exam Focus.';

  @override
  String studyKnowledgeUnits(int done, int total) {
    return 'Parts: $done/$total';
  }

  @override
  String get studyGeneratingCards => 'Generating cards from the whole file';

  @override
  String get studyGeneratingMcqs => 'Generating questions from the whole file';

  @override
  String studyGeneratingProgress(int done, int total) {
    return '$done of $total ready';
  }

  @override
  String studyGeneratingNow(String title) {
    return 'Now: $title';
  }

  @override
  String studyGeneratingQueue(int count) {
    return 'Waiting in queue ($count)';
  }

  @override
  String get studyLeaveHint =>
      'Preparation continues on the server even if you leave the app.';

  @override
  String get studyEmptyOwner =>
      'Prepare the study tools from the book page first.';

  @override
  String get studyRestart => 'Start again';

  @override
  String get studyBack => 'Back';

  @override
  String get flashEmpty => 'No cards for this file yet';

  @override
  String get flashEmptyShared => 'The owner hasn\'t generated cards yet.';

  @override
  String get flashTime => 'Time';

  @override
  String get flashRemaining => 'Left';

  @override
  String get flashLearning => 'Learning';

  @override
  String get flashMastered => 'Mastered';

  @override
  String flashCardOf(int n, int total) {
    return 'Card $n/$total';
  }

  @override
  String get flashQuestion => 'Question';

  @override
  String get flashAnswer => 'Answer';

  @override
  String get flashTapToFlip => 'Tap to flip';

  @override
  String get flashTapToQuestion => 'Tap to see the question';

  @override
  String get flashSource => 'Source';

  @override
  String get flashExplainTitle => 'About this card';

  @override
  String get flashTranslate => 'Translate';

  @override
  String get flashExplain => 'Explain';

  @override
  String get flashPrev => 'Previous';

  @override
  String get flashNext => 'Next';

  @override
  String get flashLangToggle => 'Switch card language';

  @override
  String get flashRateFailed =>
      'Couldn\'t save the rating. Check your connection.';

  @override
  String get rateAgain => 'Forgot';

  @override
  String get rateHard => 'Hard';

  @override
  String get rateGood => 'Good';

  @override
  String get rateEasy => 'Easy';

  @override
  String get flashDone => 'Review done 🎉';

  @override
  String flashDoneBody(int count, String time, int mastered, int learning) {
    return 'You reviewed $count cards in $time — $mastered mastered, $learning still learning.';
  }

  @override
  String get flashReviewHard => 'Review the hard cards';

  @override
  String get labelQuestionBi => 'QUESTION / السؤال';

  @override
  String get labelAnswerBi => 'ANSWER / الإجابة';

  @override
  String get labelTermBi => 'TERM / المصطلح';

  @override
  String get quizEmpty => 'No quiz for this file yet';

  @override
  String get quizEmptyShared => 'The owner hasn\'t generated questions yet.';

  @override
  String quizQuestionOf(int n, int total) {
    return 'Question $n of $total';
  }

  @override
  String quizPage(int page) {
    return 'Page $page';
  }

  @override
  String quizScore(int score) {
    return 'Score: $score';
  }

  @override
  String get quizFlagged => 'This question needs review';

  @override
  String get quizCorrect => 'Correct ✓';

  @override
  String get quizWrong => 'Wrong ✗';

  @override
  String get quizSaveFailed => 'Couldn\'t save your answer. Choose it again.';

  @override
  String get quizHint => 'Hint';

  @override
  String get quizSkip => 'Skip';

  @override
  String quizResult(int score, int total) {
    return 'Score: $score / $total';
  }

  @override
  String quizAnsweredSome(int answered, int total) {
    return 'You answered $answered of $total questions.';
  }

  @override
  String get quizAllCorrect => 'Excellent! All correct 🎉';

  @override
  String get quizReviewWrong => 'Go over the wrong ones and try again.';

  @override
  String get quizRetryWrong => 'Retry the wrong ones';

  @override
  String quizDot(int n) {
    return 'Question $n';
  }

  @override
  String get summaryTitle => 'Summary';

  @override
  String get summaryShowAr => 'Show in Arabic';

  @override
  String get summaryShowEn => 'Show in English';

  @override
  String get summaryCopyLink => 'Copy link';

  @override
  String get summaryLinkCopied => 'Link copied';

  @override
  String get summaryCompose => 'Make a structured summary';

  @override
  String get summaryComposeBody =>
      'Turn this part into a structured medical summary: definition, symptoms, diagnosis, treatment and red flags.';

  @override
  String get summaryEmpty => 'No summary yet';

  @override
  String get summaryEmptyShared =>
      'The owner hasn\'t prepared the summary yet.';

  @override
  String get efSubtitle => 'The exam\'s key facts';

  @override
  String efCardCount(int count) {
    return '$count key facts';
  }

  @override
  String get efPreparing => 'Preparing Exam Focus…';

  @override
  String get efStartFailed => 'Couldn\'t start Exam Focus';

  @override
  String get efTryAgain => 'Try again';

  @override
  String get efUnavailable => 'Exam Focus unavailable';

  @override
  String get efCannotOpen => 'This file can\'t be opened.';

  @override
  String get efAnalysisFailed => 'The file couldn\'t be analysed';

  @override
  String get efNothingFound => 'No clear exam facts found 🤔';

  @override
  String get efTryRegenerate => 'Try regenerating.';

  @override
  String get efRegenerate => 'Regenerate';

  @override
  String get efRegenerateConfirm =>
      'Regenerate Exam Focus? The current and saved cards will be deleted.';

  @override
  String get efSearch => 'Search cards';

  @override
  String get efSearchHint => 'Search: chemical burns, 15–30 minutes…';

  @override
  String get efClearSearch => 'Clear search';

  @override
  String get efAll => 'All';

  @override
  String get efSaved => 'Review later';

  @override
  String get efSave => 'Save to review later';

  @override
  String get efUnsave => 'Remove from saved';

  @override
  String get efProgress => 'Your progress through the cards';

  @override
  String get efNoMatch => 'No matching cards 🔎';

  @override
  String get efNoMatchHint => 'Try another word or choose “All”.';

  @override
  String efPartial(String ranges) {
    return '⚠️ Couldn\'t analyse pp. $ranges.';
  }

  @override
  String efCoverage(int covered, int total) {
    return '📊 Cards cover $covered/$total content pages';
  }

  @override
  String efNoTextPages(int count) {
    return '$count pages without readable text';
  }

  @override
  String get efProgressTitle => '⏳ Analysing your whole file…';

  @override
  String get efProgressBody =>
      'We read every page and pull out what matters for the exam. You can leave and come back; the work continues on the server.';

  @override
  String get efStageAnalyse => 'Analysing every page';

  @override
  String efStageUnits(int done, int total) {
    return '$done/$total parts';
  }

  @override
  String get efStageExtract => 'Extracting high-yield facts';

  @override
  String efStageFacts(int count) {
    return '$count facts';
  }

  @override
  String get efStageDedupe => 'Removing duplicates';

  @override
  String get efStageBuild => 'Building Exam Focus cards';

  @override
  String get efStageCoverage => 'Checking the whole file is covered';

  @override
  String efUnitPages(String range) {
    return 'pp. $range';
  }

  @override
  String get mindmapIntro =>
      'A study map linked to the summary, terms, cards and quiz questions.';

  @override
  String get mindmapChapters => 'Chapters';

  @override
  String get mindmapBranches => 'Branches';

  @override
  String get mindmapConcepts => 'Concepts';

  @override
  String get mindmapExamPoints => 'Exam points';

  @override
  String get mindmapEmpty => 'No finished chapters yet';

  @override
  String get mindmapEmptyHint =>
      'The map appears once the book\'s analysis is done.';

  @override
  String get mindmapNotBuilt => 'Ready to build';

  @override
  String mindmapChapterMeta(int branches, int points) {
    return '$branches branches · $points high-yield points';
  }

  @override
  String get mindmapSharedNotBuilt =>
      'The owner hasn\'t built this chapter\'s map yet.';

  @override
  String get mindmapBuildHint =>
      'Link the English and Arabic explanation to the terms, cards and questions in one map.';

  @override
  String get mindmapBuildFailed => 'The map couldn\'t be built. Try again.';

  @override
  String get mindmapBuild => 'Build the map';

  @override
  String get mindmapQueued => 'Queued…';

  @override
  String get mindmapBuilding => 'Building…';

  @override
  String get mindmapOpenSummary => 'Open the summary';

  @override
  String get mindmapOpenCards => 'Open the cards';

  @override
  String get mindmapKeyPoints => 'High-Yield / أهم النقاط';

  @override
  String get mindmapVisuals => 'Visual anchors / الصور والمخططات';

  @override
  String get mindmapSourceLinked => 'Source-linked branch';

  @override
  String mindmapPages(String pages) {
    return 'Pages $pages';
  }

  @override
  String get mindmapConceptsLabel => 'Concepts / المفاهيم';

  @override
  String get mindmapExamLabel => 'Exam focus / نقاط الامتحان';

  @override
  String get mindmapPromptsLabel => 'Recall prompts / أسئلة الاستدعاء';

  @override
  String get mindmapFooter =>
      'The map doesn\'t replace the summary; it reorganises it with the cards and questions so you see the whole picture and know what to review.';

  @override
  String matchSeconds(String seconds) {
    return '$seconds s';
  }

  @override
  String get matchNewRound => 'New round';

  @override
  String get matchHint =>
      'Tap a question, then its answer — as fast as you can! ⚡';

  @override
  String get matchNeedCards => 'Cards first 🃏';

  @override
  String get matchNeedCardsHint =>
      'Generate this file\'s cards, then come back to play ✨';

  @override
  String get matchMakeCards => 'Generate cards';

  @override
  String matchDone(String seconds) {
    return '$seconds s 🎉';
  }

  @override
  String get matchRecord => 'New record! 🏆 Great job 💪';

  @override
  String matchBest(String seconds) {
    return 'Your best: $seconds s — you can beat it! 🔥';
  }

  @override
  String matchMistakes(int count) {
    return 'Mistakes: $count (+1 s each)';
  }

  @override
  String get matchPlayAgain => 'Play again';

  @override
  String matchBestLine(String seconds) {
    return '🏆 Best: $seconds s';
  }

  @override
  String get reviewTitle => 'Daily review';

  @override
  String get reviewEmpty => 'Great — nothing due today';

  @override
  String get reviewEmptyHint =>
      'Come back later, or upload a new book or file.';

  @override
  String reviewLeft(int count) {
    return '$count cards to go';
  }

  @override
  String reviewRemaining(int count) {
    return '$count left';
  }

  @override
  String reviewMastered(int count) {
    return '$count mastered';
  }

  @override
  String get reviewViewInBook => 'View in book';

  @override
  String get reviewShowAnswer => 'Show answer';

  @override
  String get reviewRelatedTerm => 'Related term';

  @override
  String get reviewExplain => 'Explain simply';

  @override
  String get reviewSimpler => 'In simpler words';

  @override
  String get statsIntro =>
      'Your progress in numbers — your reviews and accuracy at a glance.';

  @override
  String get statsReviewed => 'Cards reviewed';

  @override
  String get statsReviewedHint => 'All reviews';

  @override
  String get statsAccuracy => 'Correct answers';

  @override
  String get statsAccuracyHint => 'Of the questions you answered';

  @override
  String get statsStreak => 'Day streak';

  @override
  String get statsStreakHint => 'Days in a row';

  @override
  String get statsHours => 'Study hours';

  @override
  String get statsHoursHint => 'Approximately';

  @override
  String get weakTitle => 'Weak points';

  @override
  String get weakRowHint => 'Questions you got wrong';

  @override
  String get weakIntro =>
      'Questions whose last answer was wrong — answer correctly to clear them.';

  @override
  String get weakChapters => 'Weakest chapters';

  @override
  String get weakEmpty => 'No weak points right now';

  @override
  String get weakEmptyHint =>
      'You haven\'t missed a question yet, or you\'ve fixed every one you missed.';

  @override
  String get todayTitle => 'Today\'s plan';

  @override
  String get todayRowHint => 'Due cards, next exam, the week ahead';

  @override
  String get todayIntro =>
      'What will you study today? All your folders at a glance.';

  @override
  String get todayDue => 'Due today';

  @override
  String todayDueCount(int count) {
    return '$count cards are waiting, from question files and books together.';
  }

  @override
  String get todayStartReview => 'Start review';

  @override
  String get todayNothingDue => 'Nothing is due right now.';

  @override
  String get todayExam => 'Next exam';

  @override
  String todayExamLine(String name, String date, int days) {
    return '$name — $date (in $days days)';
  }

  @override
  String get todayContinue => 'Keep reading';

  @override
  String get todayNoBook => 'Upload your first book to start.';

  @override
  String get todayOpenBook => 'Open the book';

  @override
  String get todayForecast => 'The week ahead (books)';

  @override
  String get todayNoForecast => 'No reviews scheduled soon.';

  @override
  String get todayFolders => 'Your folders';

  @override
  String todayFolderBooks(int count) {
    return '$count books';
  }

  @override
  String todayFolderExam(String date) {
    return 'exam $date';
  }

  @override
  String get bookMoveFolder => 'Move to folder';

  @override
  String get bookRemoveShared => 'Remove from my library';

  @override
  String get bookRemoveSharedBody =>
      'Remove this file from your library? The owner keeps the original and can share it with you again.';

  @override
  String studyKnowledgeLine(String tool, int covered, int total) {
    return '🧠 Knowledge: $tool cover $covered/$total facts';
  }

  @override
  String get studyRebuildCards => '✨ Rebuild the cards from the knowledge base';

  @override
  String get studyRebuildMcqs =>
      '✨ Rebuild the questions from the knowledge base';

  @override
  String get studyRebuildTitle => 'Rebuild';

  @override
  String get studyRebuildCardsConfirm =>
      'The current cards will be replaced by cards built from the knowledge base (every fact in the file), and review progress on the old cards will be lost. Continue?';

  @override
  String get studyRebuildMcqsConfirm =>
      'The current questions will be replaced by applied questions built from the knowledge base (every fact in the file). Continue?';

  @override
  String get studyRebuildNotReady =>
      'The knowledge base isn\'t ready yet — try later.';

  @override
  String studyMatrixTitle(int covered, int total) {
    return '🧭 Coverage map · $covered/$total';
  }

  @override
  String get studyMatrixHint =>
      'Each Exam Focus fact → the cards 🃏 and questions ❓ built from it → its pages.';

  @override
  String studyMatrixPages(String pages) {
    return 'pp. $pages';
  }

  @override
  String get readerOpening => 'Opening the file…';

  @override
  String get readerNoFile => 'This file couldn\'t be found';

  @override
  String get readerNoFileHint => 'Go back to the book and try again.';

  @override
  String get readerGoTo => 'Go to page';

  @override
  String get readerGo => 'Go';

  @override
  String readerPageOf(int page, int count) {
    return 'Page $page of $count';
  }

  @override
  String readerPageRange(int count) {
    return 'From 1 to $count';
  }

  @override
  String get readerSearch => 'Search the file';

  @override
  String get readerSearchHint => 'A word or phrase…';

  @override
  String get readerNoMatches => 'No results.';

  @override
  String get readerAskPage => 'Ask Niro about the page';

  @override
  String get readerHighlight => 'Highlight';

  @override
  String get readerAskSelection => 'Ask Niro';

  @override
  String get readerToolHighlight => 'Highlight';

  @override
  String get readerToolPen => 'Pen';

  @override
  String get readerToolEraser => 'Eraser';

  @override
  String get readerSaving => 'Saving…';

  @override
  String get readerSaved => 'Saved';

  @override
  String get readerSaveFailed => 'Couldn\'t save';

  @override
  String get readerHintHighlight =>
      'Select text on the page, then tap “Highlight”.';

  @override
  String get readerHintPen => 'Draw freely on the page to mark what matters.';

  @override
  String get readerHintEraser =>
      'Swipe over a highlight or drawing to erase it.';

  @override
  String askTitle(int page) {
    return 'Ask Niro · page $page';
  }

  @override
  String askWholePage(int page) {
    return 'The whole of page $page — select text first to ask about it alone.';
  }

  @override
  String get askExplain => 'Explain simply';

  @override
  String get askExplainPage => 'Explain the page';

  @override
  String get askArabic => 'Explain in Arabic';

  @override
  String get askExam => 'Exam question';

  @override
  String get askSummarize => 'Summarise';

  @override
  String get askSummarizePage => 'Summarise the page';

  @override
  String get askThinking => 'Niro is writing…';

  @override
  String get askHint => 'Ask about this…';

  @override
  String get askSend => 'Send';

  @override
  String get askStop => 'Stop';

  @override
  String get bookChatTitle => 'Ask Niro about this file';

  @override
  String get bookChatHello =>
      'Hi, I\'m Niro 👋 Ask me anything about this file.';

  @override
  String get qfTitle => 'Question banks';

  @override
  String get qfIntro =>
      'Questions taken straight from your files — nothing generated by AI.';

  @override
  String get qfUpload => 'Upload a question file';

  @override
  String get qfUploadTitle => 'Upload a question file';

  @override
  String get qfEmpty => 'No question files yet';

  @override
  String get qfEmptyHint => 'Upload a file and choose “Question file”.';

  @override
  String qfCount(int count) {
    return '$count questions';
  }

  @override
  String get qfStatusExtracting => 'Extracting…';

  @override
  String get qfStatusComplete => 'Extracted';

  @override
  String get qfStatusFailed => 'Extraction failed';

  @override
  String get qfStatusPending => 'Waiting';

  @override
  String get qfExtracting =>
      'Extracting the questions from the file — you can close this and come back later.';

  @override
  String get qfFailed => 'Couldn\'t extract the questions from this file.';

  @override
  String get qfRetry => 'Process again';

  @override
  String get qfNoQuestions => 'No questions were found';

  @override
  String qfExtractedCount(int count) {
    return '$count questions extracted';
  }

  @override
  String qfEnriching(int done, int total) {
    return 'Adding images and explanations ($done/$total)';
  }

  @override
  String get qfKind => 'Question file';

  @override
  String get qfKindNote =>
      'The questions actually in the file will be extracted — no new questions are generated by AI.';

  @override
  String get qfSubmit => 'Extract the questions';

  @override
  String qfQuotaLeft(int left, int limit) {
    return 'Left today: $left of $limit question files';
  }

  @override
  String get uploadStepKind => 'File type';

  @override
  String get questionsLabel => 'Question';

  @override
  String questionsPosition(int index, int total) {
    return 'Question $index of $total';
  }

  @override
  String questionsTally(int answered, int correct) {
    return 'Answered $answered · right $correct';
  }

  @override
  String get questionsProgressLabel => 'Progress through the questions';

  @override
  String questionsCardLabel(int index, int total) {
    return 'Question $index of $total';
  }

  @override
  String get questionsPickerTitle => 'Go to a question';

  @override
  String get questionsReveal => 'Show the answer';

  @override
  String get questionsReset => 'Reset';

  @override
  String get questionsNoAnswerInFile =>
      'The file doesn\'t state an answer for this question.';

  @override
  String get questionsNoAnswer => 'No answer is given for this question.';

  @override
  String get questionsAiAnswer =>
      'Answer suggested by AI — the original file doesn\'t state one.';

  @override
  String get questionsMachineTranslation => 'Machine translation';

  @override
  String get doctorSetsTitle => 'Doctor sets';

  @override
  String get qfUploadIntro =>
      'Upload a question file (a bank, a past exam, scanned questions) and its questions are extracted as they are, with their answers when the file has them.';

  @override
  String get qfStepFile => 'The file';

  @override
  String get niroTitle => 'Ask Niro';

  @override
  String get niroSubtitle => 'Your study buddy, whenever you need it 😌';

  @override
  String get niroNewChat => 'New';

  @override
  String get niroHello => 'Hi! I\'m Niro 👋';

  @override
  String niroHelloName(String name) {
    return 'Hi $name! I\'m Niro 👋';
  }

  @override
  String get niroAskAnything =>
      'Ask me anything — explain, solve, translate, or snap the question 📸';

  @override
  String get niroStarterPhoto => 'Snap a question or a page and I\'ll solve it';

  @override
  String get niroReadingPhoto => 'Niro is reading the photo… 🔍';

  @override
  String get niroUnreachable => 'Couldn\'t reach the assistant, try again 🙏';

  @override
  String get niroPhotoFailed => 'Couldn\'t read the photo, try another one 🙏';

  @override
  String niroRemaining(int count) {
    return '$count messages left today';
  }

  @override
  String get niroCopy => 'Copy';

  @override
  String get niroCopied => 'Copied';

  @override
  String get niroCamera => 'Take a photo';

  @override
  String get niroGallery => 'Choose from photos';

  @override
  String get niroHint => 'Type your question…';

  @override
  String get niroHintPhoto => 'Ask about the photo (optional)…';

  @override
  String get niroAttachedPhoto => 'Attached photo';

  @override
  String get niroSentPhoto => 'Sent photo';

  @override
  String get niroRemovePhoto => 'Remove the photo';

  @override
  String get niroCameraTitle => 'The camera is for snapping your question 📷';

  @override
  String get niroCameraWhy1 =>
      'Snap a question, a page or your notes, and Niro reads and solves it.';

  @override
  String get niroCameraWhy2 =>
      'The camera opens only when you tap the button — nothing in the background.';

  @override
  String get niroCameraWhy3 =>
      'The photo is sent only to be analysed and isn\'t stored on our servers.';

  @override
  String get niroCameraWhy4 =>
      'If you decline, you can always choose a photo instead.';

  @override
  String get niroNotNow => 'Not now';

  @override
  String get niroCameraDenied => 'Camera access is off';

  @override
  String get niroPhotosDenied => 'Photo access is off';

  @override
  String get niroDeniedHint =>
      'You can allow it in the device settings, or choose a photo from your gallery instead.';

  @override
  String get niroOpenSettings => 'Open Settings';

  @override
  String get dsIntro =>
      'Questions your doctor shares with their students. You get in with a code from your doctor.';

  @override
  String get dsCodeLabel => 'Access code';

  @override
  String get dsAddSet => 'Add the set';

  @override
  String get dsChecking => 'Checking…';

  @override
  String get dsAlreadyAdded => 'This set is already in your account.';

  @override
  String get dsMine => 'My sets';

  @override
  String get dsMineEmpty => 'No sets yet.';

  @override
  String get dsMineEmptyHint => 'Got a code from your doctor? Enter it above.';

  @override
  String get dsListedTitle => 'Published sets';

  @override
  String get dsListedNote =>
      'Shown for information only. Opening any set needs a code from its doctor.';

  @override
  String get dsByCode => '🔒 code';

  @override
  String get dsAvailable => 'Available';

  @override
  String dsOpensAt(String date) {
    return 'Opens $date';
  }

  @override
  String get dsUnavailable => 'Not available now';

  @override
  String dsUntil(String date) {
    return 'until $date';
  }

  @override
  String get dsSetUnavailable => 'This set isn\'t available right now';

  @override
  String get dsFeatureOff => 'This feature isn\'t available right now.';

  @override
  String get dsApplyTitle => 'Doctor account';

  @override
  String get dsApplyIntro =>
      'Upload your question files and give your students access codes. Your account and login stay the same.';

  @override
  String get dsPending => 'Under review';

  @override
  String get dsPendingBody =>
      'Your application arrived and the NiroLearn team will review it.';

  @override
  String get dsApproved => 'Approved doctor';

  @override
  String get dsApprovedBody => 'Your account is approved as a doctor.';

  @override
  String get dsOpenDashboard => 'Open the doctor dashboard';

  @override
  String get dsSuspended => 'Suspended';

  @override
  String get dsSuspendedBody => 'Doctor access is suspended for now.';

  @override
  String get dsSuspendedHint =>
      'Your sets aren\'t available to your students meanwhile. Contact us to find out why.';

  @override
  String get dsRejected => 'Not approved';

  @override
  String get dsRejectedBody =>
      'We couldn\'t approve your previous application.';

  @override
  String dsRejectedReason(String reason) {
    return 'Reason: $reason';
  }

  @override
  String get dsRejectedHint => 'You can edit the details and apply again.';

  @override
  String get dsFullName => 'Full name';

  @override
  String get dsUniversity => 'University';

  @override
  String get dsFaculty => 'Faculty';

  @override
  String get dsDepartment => 'Department';

  @override
  String get dsUniEmail => 'University email (optional, helps verification)';

  @override
  String get dsNote => 'Note for the reviewer (optional)';

  @override
  String get dsSendApplication => 'Send the application';

  @override
  String get dsDashboardIntro =>
      'Protected question sets: upload the file once, your students get in with a code.';

  @override
  String get dsStatSets => 'Sets';

  @override
  String get dsStatPublished => 'Published';

  @override
  String get dsStatDisabled => 'Disabled';

  @override
  String get dsStatCodes => 'Codes made';

  @override
  String get dsStatStudents => 'Active students';

  @override
  String get dsNewSet => 'New set';

  @override
  String get dsDoctorEmptyHint =>
      'Upload a PDF of questions, review what was extracted, then publish it and make codes for your students.';

  @override
  String get dsRecent => 'Recent activity';

  @override
  String dsStudentsCount(int count) {
    return '$count students';
  }

  @override
  String dsCodesUsed(int claimed, int total) {
    return '$claimed/$total codes used';
  }

  @override
  String get dsNewSetTitle => 'New question set';

  @override
  String get dsNewSetIntro =>
      'The file is processed once, by the same question-file pipeline. You review the questions, then publish and make codes.';

  @override
  String get dsFileLabel => 'Question file (PDF)';

  @override
  String get dsFileHint =>
      'Text or scanned — scanned pages are read by OCR and take a little longer. Counts against your plan\'s question files.';

  @override
  String get dsCreateSet => 'Upload and create the set';

  @override
  String get dsStarting => 'Starting the processing…';

  @override
  String get dsTitle => 'Set title';

  @override
  String get dsDescription => 'Description (optional)';

  @override
  String get dsSubject => 'Subject';

  @override
  String get dsYear => 'Academic year';

  @override
  String get dsExamType => 'Exam type';

  @override
  String get dsVisibility => 'Visibility';

  @override
  String get dsUnlisted =>
      'Unlisted — you give the codes to your students directly';

  @override
  String get dsListed =>
      'Listed — students see its title; getting in still needs a code';

  @override
  String get dsListedShort => 'listed';

  @override
  String get dsUnlistedShort => 'unlisted';

  @override
  String get dsStarts => 'Starts';

  @override
  String get dsEnds => 'Ends';

  @override
  String get dsPickDate => 'Pick';

  @override
  String get dsClearDate => 'No date';

  @override
  String get dsTabQuestions => 'Questions';

  @override
  String get dsTabSettings => 'Settings';

  @override
  String get dsTabCodes => 'Codes';

  @override
  String get dsTabStudents => 'Students';

  @override
  String get dsTabAudit => 'Log';

  @override
  String get dsProcessing =>
      'Processing with the question-file pipeline. You can close this and come back.';

  @override
  String get dsReviewFirst =>
      'Review the questions below as your students will see them.';

  @override
  String get dsNoEditAfterPublish =>
      'Questions can\'t change after publishing. To fix them, create a new set from a corrected file.';

  @override
  String get dsPublish => 'Publish the set';

  @override
  String get dsPublished => 'Published';

  @override
  String get dsShowAllAnswers => 'Show every answer';

  @override
  String get dsHideAnswers => 'Hide the answers';

  @override
  String get dsMachineNote =>
      'Some translations are machine-made (tagged «ترجمة آلية») — check them.';

  @override
  String get dsNoQuestionsYet => 'No questions extracted yet.';

  @override
  String get dsImageChecks => 'Images to check';

  @override
  String get dsImageChecksNote =>
      'These pages had an image it wasn\'t clear which question it belongs to, so it wasn\'t attached (the questions show to students without it).';

  @override
  String dsQuestionOnPage(int index, int page) {
    return 'Question $index · page $page';
  }

  @override
  String dsNeedsReview(int count) {
    return 'Needs review · $count';
  }

  @override
  String get dsNeedsReviewNote =>
      'These parts weren\'t complete questions, so your students don\'t see them. Nothing missing was filled in by the system.';

  @override
  String get dsNoStem => '(no question text)';

  @override
  String get dsAccess => 'Access';

  @override
  String get dsAccessNote =>
      'Disabling stops every student\'s access at once without deleting anything; you can enable it again any time. Archiving is final.';

  @override
  String get dsDisableNow => 'Disable access now';

  @override
  String get dsEnable => 'Enable again';

  @override
  String get dsArchive => 'Archive the set';

  @override
  String get dsArchiveConfirm =>
      'Archiving is final: students lose access and it can\'t be undone.';

  @override
  String get dsArchiveFinal => 'Archive permanently';

  @override
  String get dsCodesAfterPublish =>
      'Codes can be made once the set is published.';

  @override
  String get dsCodeCount =>
      'How many codes (one per student, up to 500 at a time)';

  @override
  String dsGenerate(int count) {
    return 'Make $count codes';
  }

  @override
  String dsFreshCodes(int count) {
    return '$count new codes — save them now, they won\'t show in full again.';
  }

  @override
  String get dsFreshCodesNote =>
      'The codes file is sensitive: whoever has a code can get in. Share it with your students only.';

  @override
  String get dsShareCsv => 'Share the CSV';

  @override
  String get dsCopyAll => 'Copy all';

  @override
  String get dsHideCodes => 'Saved them, hide';

  @override
  String get dsAll => 'All';

  @override
  String get dsUnused => 'Unused';

  @override
  String get dsClaimed => 'Used';

  @override
  String get dsRevokedLabel => 'Revoked';

  @override
  String get dsCodeSearch => 'Last 4 characters or @name';

  @override
  String get dsNoCodes => 'No codes match this filter.';

  @override
  String dsCodeClaimed(String who, String date) {
    return 'Used · $who · $date';
  }

  @override
  String dsCodeRevoked(String date) {
    return 'Revoked · $date';
  }

  @override
  String dsCodeUnused(String date) {
    return 'Unused · $date';
  }

  @override
  String get dsStudent => 'Student';

  @override
  String get dsRevoke => 'Revoke';

  @override
  String get dsNoStudents => 'No student has used a code yet.';

  @override
  String get dsActive => 'Active';

  @override
  String get dsWithdrawn => 'Withdrawn';

  @override
  String get dsWithdraw => 'Withdraw access';

  @override
  String get dsWithdrawConfirm =>
      'This student loses access to the set right away.';

  @override
  String get dsWithdrawYes => 'Withdraw';
}
