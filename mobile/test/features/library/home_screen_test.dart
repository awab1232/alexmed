import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/library/data/library_models.dart';

import '../../helpers/app_harness.dart';

const anatomy = Subject(
  id: 's1',
  name: 'تشريح',
  type: 'medical',
  bookCount: 2,
  deckCount: 1,
);
const pharma = Subject(id: 's2', name: 'أدوية', type: 'medical', bookCount: 1);

BookSummary book(
  String id, {
  int chapters = 4,
  int done = 4,
  String? subjectId,
}) => BookSummary(
  id: id,
  fileName: 'Book_$id.pdf',
  subjectId: subjectId,
  pageCount: 30,
  chapterCount: chapters,
  completeChapterCount: done,
);

void main() {
  testWidgets(
    'first visit: greeting with first name, "upload your first book", empty folders',
    (tester) async {
      await pumpNiroLearn(tester, session: signedIn);
      expect(find.textContaining('، سارة'), findsOneWidget);
      expect(find.text('ارفع أول كتاب لك'), findsOneWidget);
      expect(find.widgetWithText(NlButton, 'ارفع كتابًا'), findsOneWidget);
      expect(find.text('مجلداتي'), findsOneWidget);
      expect(find.textContaining('لا توجد مجلدات بعد'), findsOneWidget);
    },
  );

  testWidgets('due cards come first in the next-step panel', (tester) async {
    final library = FakeLibraryRepository()
      ..due = 7
      ..bookList = [book('b1')];
    await pumpNiroLearn(tester, session: signedIn, library: library);
    expect(find.text('7 بطاقة جاهزة للمراجعة'), findsOneWidget);
    expect(find.widgetWithText(NlButton, 'ابدأ المراجعة'), findsOneWidget);
  });

  testWidgets('a ready book → "continue", listed under your books', (
    tester,
  ) async {
    final library = FakeLibraryRepository()..bookList = [book('b1')];
    await pumpNiroLearn(tester, session: signedIn, library: library);
    expect(find.textContaining('تابع «'), findsOneWidget);
    expect(find.text('كتبك'), findsOneWidget);
    expect(find.text('4 من 4 أجزاء جاهزة'), findsOneWidget);
  });

  testWidgets('a book still being prepared is the next step', (tester) async {
    final library = FakeLibraryRepository()
      ..bookList = [book('b1', chapters: 0, done: 0)];
    // The spine animates while preparing — never settles.
    await pumpNiroLearn(
      tester,
      session: signedIn,
      library: library,
      settle: false,
    );
    expect(find.textContaining('نجهّز «'), findsOneWidget);
    expect(find.text('نقرأ الصفحات…'), findsOneWidget);
  });

  testWidgets('folders list → open a folder → its books, move one out', (
    tester,
  ) async {
    final library = FakeLibraryRepository()
      ..folders = [anatomy, pharma]
      ..bookList = [book('b1', subjectId: 's1'), book('b2', subjectId: 's2')];
    await pumpNiroLearn(tester, session: signedIn, library: library);

    expect(findLabel('تشريح'), findsOneWidget);
    expect(find.textContaining('كتابان').evaluate().isEmpty, isTrue);
    await tester.tap(findLabel('تشريح'));
    await tester.pumpAndSettle();

    // Folder page: only this folder's books; bottom bar still there.
    expect(find.byType(NlBottomNav), findsOneWidget);
    expect(find.textContaining('Book b1'), findsOneWidget);
    expect(find.textContaining('Book b2'), findsNothing);

    await tester.tap(find.byTooltip('نقل إلى مجلد'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('أدوية').last);
    await tester.pumpAndSettle();
    expect(library.calls, contains('moveBook:b1:s2'));
    expect(find.text('تم النقل.'), findsOneWidget);
    expect(find.textContaining('Book b1'), findsNothing);
  });

  testWidgets('create a folder from Home', (tester) async {
    final library = FakeLibraryRepository();
    await pumpNiroLearn(tester, session: signedIn, library: library);
    await tester.tap(find.widgetWithText(NlButton, 'مجلد جديد'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'فسيولوجي');
    await tester.pump();
    await tester.tap(find.widgetWithText(NlButton, 'إنشاء'));
    await tester.pumpAndSettle();
    expect(library.calls, contains('create:فسيولوجي:general'));
    expect(findLabel('فسيولوجي'), findsOneWidget);
  });

  testWidgets('rename and delete a folder', (tester) async {
    final library = FakeLibraryRepository()..folders = [anatomy];
    await pumpNiroLearn(tester, session: signedIn, library: library);
    await tester.tap(findLabel('تشريح'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('خيارات المجلد'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('إعادة التسمية'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'تشريح عام');
    await tester.pump();
    await tester.tap(find.widgetWithText(NlButton, 'حفظ'));
    await tester.pumpAndSettle();
    expect(library.calls, contains('rename:s1:تشريح عام'));

    await tester.tap(find.byTooltip('خيارات المجلد'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('حذف المجلد').last);
    await tester.pumpAndSettle();
    expect(find.text('حذف المجلد؟'), findsOneWidget);
    await tester.tap(find.widgetWithText(NlButton, 'حذف المجلد'));
    await tester.pumpAndSettle();
    expect(library.calls, contains('delete:s1'));
    // Back on Home, folder gone.
    expect(find.text('مجلداتي'), findsOneWidget);
    expect(findLabel('تشريح عام'), findsNothing);
  });

  testWidgets('offline: folders show the reason and retry', (tester) async {
    final library = FakeLibraryRepository()
      ..failWith = const NetworkException();
    await pumpNiroLearn(tester, session: signedIn, library: library);
    expect(find.textContaining('تحقق من الإنترنت'), findsWidgets);
    library.failWith = null;
    library.folders = [anatomy];
    await tester.tap(find.widgetWithText(NlButton, 'أعد المحاولة').first);
    await tester.pumpAndSettle();
    expect(findLabel('تشريح'), findsOneWidget);
  });

  testWidgets('shared: pending requests take the row', (tester) async {
    final library = FakeLibraryRepository()
      ..shared = const SharedSummary(pending: 2);
    await pumpNiroLearn(tester, session: signedIn, library: library);
    expect(find.text('لديك 2 طلبات مشاركة جديدة'), findsOneWidget);
  });

  testWidgets('＋ opens the add sheet; doctor code only when enabled', (
    tester,
  ) async {
    await pumpNiroLearn(tester, session: signedIn);
    await tester.tap(find.byTooltip('إضافة'));
    await tester.pumpAndSettle();
    expect(find.text('ماذا تريد أن تضيف؟'), findsOneWidget);
    expect(find.text('كتاب دراسي'), findsOneWidget);
    expect(find.text('ملف أسئلة'), findsOneWidget);
    expect(find.text('كود من دكتورك'), findsNothing);
  });
}
