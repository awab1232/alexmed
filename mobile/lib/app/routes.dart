/// Route paths (blueprint §5). Tab roots mirror components/BottomNav.tsx.
/// Kept apart from the router so screens can navigate without importing it.
abstract final class Routes {
  static const splash = '/splash';
  static const welcome = '/welcome';
  static const login = '/login';
  static const register = '/register';

  // Tab roots.
  static const home = '/home';
  static const games = '/games';
  static const assistant = '/assistant';
  static const account = '/account';

  // Inside the Home tab (keeps the bottom bar).
  static String folder(String id) => '/home/folders/$id';

  // Inside the Account tab.
  static const plan = '/account/plan';
  static const stats = '/account/stats';
  static const doctorApply = '/account/doctor';

  // Full-screen (built in later phases — placeholders until then).
  static String book(String id) => '/books/$id';
  static String bookStudy(String id, String tool) =>
      '/books/$id/study?tool=$tool';
  static String bookMindmap(String id) => '/books/$id/mindmap';
  static String bookMatch(String id) => '/books/$id/match';
  static String bookExamFocus(String id) => '/books/$id/exam-focus';
  static String bookRead(String id) => '/books/$id/read';
  static String deck(String id) => '/decks/$id';
  static const review = '/review';
  static const weakPoints = '/weak-points';
  static const today = '/today';
  static const questionFiles = '/question-files';
  static const uploadBook = '/upload/book';
  static String uploadBookIn(String subjectId) =>
      '$uploadBook?subjectId=$subjectId';
  static const uploadQuestionFile = '/upload/question-file';
  static String mirrorAppend(String deckId) =>
      '$uploadQuestionFile?deck=$deckId';
  static String mirrorJob(String id, {bool detailsOnly = false}) =>
      '/mirror/jobs/$id${detailsOnly ? '?details=1' : ''}';
  static const shared = '/shared';
  static const redeemCode = '/question-sets/redeem';
  static const doctor = '/doctor';

  /// Debug builds only — the design-system gallery.
  static const gallery = '/dev/gallery';

  static const authFlow = {welcome, login, register};
}
