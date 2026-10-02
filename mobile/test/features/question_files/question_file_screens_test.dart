import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/core/upload/pdf_upload.dart';
import 'package:nirolearn/features/books/presentation/book_upload_screen.dart';
import 'package:nirolearn/features/library/data/library_models.dart';
import 'package:nirolearn/features/question_files/data/question_file_models.dart';
import 'package:nirolearn/features/question_files/data/question_file_repository.dart';
import 'package:nirolearn/features/question_files/presentation/question_deck_view.dart';
import 'package:nirolearn/features/question_files/presentation/question_file_screen.dart';
import 'package:nirolearn/features/question_files/presentation/question_files_screen.dart';

import '../../helpers/app_harness.dart';
import '../../helpers/screen_harness.dart';

class FakeQuestionFileRepository implements QuestionFileRepository {
  final calls = <String>[];
  List<QuestionFileSummary> files = [];
  List<QuestionFileDetail> details = [];

  @override
  Future<List<QuestionFileSummary>> list() async {
    calls.add('list');
    return files;
  }

  @override
  Future<QuestionFileDetail> get(String id) async {
    calls.add('get:$id');
    return details.length > 1 ? details.removeAt(0) : details.single;
  }

  @override
  Future<void> retryExtraction(String id) async => calls.add('retry:$id');

  @override
  Future<String> upload({
    required PickedPdf pdf,
    required String subjectId,
    void Function(double progress)? onProgress,
    CancelToken? cancelToken,
  }) async {
    calls.add('upload:${pdf.name}:$subjectId');
    return 'qf9';
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

const qStated = QuestionItem(
  id: 'q1',
  questionText: 'Which drug is a loop diuretic?',
  options: ['Mannitol', 'Furosemide', 'Amiloride'],
  extractedAnswerIndex: 1,
  explanationText: 'Acts on the loop of Henle.',
  aiExplanationAr: 'يعمل على عروة هنلي.',
  keywords: ['loop diuretic'],
  questionTextAr: 'أي دواء مدر عروي؟',
  optionsAr: ['مانيتول', 'فوروسيميد', 'أميلوريد'],
  translationSource: 'machine',
);
const qAi = QuestionItem(
  id: 'q2',
  questionText: 'Pacemaker of the heart?',
  options: ['AV node', 'SA node'],
  aiInferredAnswerIndex: 1,
);
const qNone = QuestionItem(id: 'q3', questionText: 'Define homeostasis.');

QuestionFileDetail detail(
  QuestionFileStatus status, {
  List<QuestionItem> questions = const [],
  String? error,
  bool done = true,
}) => QuestionFileDetail(
  id: 'qf1',
  fileName: 'Pharma_Qs.pdf',
  status: status,
  extractionError: error,
  content: QuestionContent(
    questions: questions,
    coverage: QuestionFileCoverage(
      done: done,
      questionsTotal: questions.length,
    ),
  ),
);

Future<FakeQuestionFileRepository> pumpDetail(
  WidgetTester tester,
  List<QuestionFileDetail> details,
) async {
  final repo = FakeQuestionFileRepository()..details = details;
  await pumpOne(
    tester,
    const QuestionFileScreen(
      fileId: 'qf1',
      pollBase: Duration(milliseconds: 10),
    ),
    overrides: [questionFileRepositoryProvider.overrideWithValue(repo)],
  );
  await pumpFrames(tester);
  return repo;
}

void main() {
  testWidgets('list: status per file, count when complete, opens the file', (
    tester,
  ) async {
    final repo = FakeQuestionFileRepository()
      ..files = const [
        QuestionFileSummary(
          id: 'qf1',
          fileName: 'Pharma_Qs.pdf',
          status: QuestionFileStatus.complete,
          questionCount: 42,
        ),
        QuestionFileSummary(
          id: 'qf2',
          fileName: 'Anatomy.pdf',
          status: QuestionFileStatus.extracting,
        ),
      ];
    await pumpOne(
      tester,
      const QuestionFilesScreen(),
      overrides: [questionFileRepositoryProvider.overrideWithValue(repo)],
    );
    await pumpFrames(tester);
    expect(find.text('تم الاستخراج · 42 سؤال'), findsOneWidget);
    expect(find.text('جاري الاستخراج…'), findsOneWidget);
    await tester.tap(find.textContaining('Pharma'));
    await pumpFrames(tester);
    expect(find.text('ROUTE /books/question-files/qf1'), findsOneWidget);
  });

  testWidgets('list: empty state offers the upload', (tester) async {
    await pumpOne(
      tester,
      const QuestionFilesScreen(),
      overrides: [
        questionFileRepositoryProvider.overrideWithValue(
          FakeQuestionFileRepository(),
        ),
      ],
    );
    await pumpFrames(tester);
    expect(find.text('لا توجد ملفات أسئلة بعد'), findsOneWidget);
    await tester.tap(find.widgetWithText(NlButton, 'رفع ملف أسئلة'));
    await pumpFrames(tester);
    expect(find.text('ROUTE /upload/book?kind=questions'), findsOneWidget);
  });

  testWidgets('extracting → polls until the questions arrive', (tester) async {
    final repo = await pumpDetail(tester, [
      detail(QuestionFileStatus.extracting),
      detail(QuestionFileStatus.complete, questions: const [qStated]),
    ]);
    await pumpFrames(tester, 10);
    expect(repo.calls.where((c) => c == 'get:qf1').length, greaterThan(1));
    expect(find.text('السؤال 1 من 1'), findsOneWidget);
    expect(find.text('1 سؤال مستخرج'), findsOneWidget);
  });

  testWidgets('failed: server reason + retry', (tester) async {
    final repo = await pumpDetail(tester, [
      detail(QuestionFileStatus.failed, error: 'الملف فارغ.'),
    ]);
    expect(find.text('الملف فارغ.'), findsOneWidget);
    await tester.tap(find.widgetWithText(NlButton, 'إعادة المعالجة'));
    await pumpFrames(tester);
    expect(repo.calls, contains('retry:qf1'));
  });

  testWidgets('complete without questions → empty', (tester) async {
    await pumpDetail(tester, [detail(QuestionFileStatus.complete)]);
    expect(find.text('لم يتم العثور على أسئلة'), findsOneWidget);
  });

  testWidgets('answering: wrong pick → red + right one green, tally, reset', (
    tester,
  ) async {
    await pumpDetail(tester, [
      detail(
        QuestionFileStatus.complete,
        questions: const [qStated, qAi, qNone],
      ),
    ]);
    expect(find.text('السؤال 1 من 3'), findsOneWidget);
    await tester.tap(find.text('Mannitol'));
    await pumpFrames(tester);
    expect(find.text('إجابة خاطئة'), findsOneWidget);
    expect(find.text('يعمل على عروة هنلي.'), findsOneWidget);
    expect(find.text('loop diuretic'), findsOneWidget);
    expect(find.text('أجبت 1 · صحيح 0'), findsOneWidget);
    final tiles = tester
        .widgetList<QuestionOptionTile>(find.byType(QuestionOptionTile))
        .map((t) => t.state.name)
        .toList();
    expect(tiles, ['wrong', 'correct', 'dimmed']);

    await tester.tap(find.text('عرض الترجمة'));
    await pumpFrames(tester);
    expect(find.text('ترجمة آلية'), findsOneWidget);
    expect(find.text('أي دواء مدر عروي؟'), findsOneWidget);

    await tester.tap(find.text('إعادة'));
    await pumpFrames(tester);
    expect(find.text('إجابة خاطئة'), findsNothing);
  });

  testWidgets('AI-suggested answer is labelled; no answer is said plainly', (
    tester,
  ) async {
    await pumpDetail(tester, [
      detail(
        QuestionFileStatus.complete,
        questions: const [qStated, qAi, qNone],
      ),
    ]);
    await tester.tap(find.text('التالي'));
    await pumpFrames(tester);
    await tester.tap(find.text('SA node'));
    await pumpFrames(tester);
    expect(find.text('إجابة صحيحة'), findsOneWidget);
    expect(
      find.textContaining('إجابة مقترحة من الذكاء الاصطناعي'),
      findsOneWidget,
    );

    await tester.tap(find.text('التالي'));
    await pumpFrames(tester);
    await tester.tap(find.text('أظهر الإجابة'));
    await pumpFrames(tester);
    expect(find.text('لا توجد إجابة مذكورة لهذا السؤال.'), findsOneWidget);
  });

  testWidgets('picker marks answered questions and jumps; answers survive', (
    tester,
  ) async {
    await pumpDetail(tester, [
      detail(
        QuestionFileStatus.complete,
        questions: const [qStated, qAi, qNone],
      ),
    ]);
    await tester.tap(find.text('Furosemide'));
    await pumpFrames(tester);
    await tester.tap(find.byKey(const ValueKey('question-picker')));
    await pumpFrames(tester);
    expect(find.text('1 ✓'), findsOneWidget);
    await tester.tap(find.text('3'));
    await pumpFrames(tester);
    expect(find.text('السؤال 3 من 3'), findsOneWidget);
    await tester.tap(find.text('السابق'));
    await pumpFrames(tester);
    await tester.tap(find.text('السابق'));
    await pumpFrames(tester);
    expect(find.text('إجابة صحيحة'), findsOneWidget);
  });

  testWidgets('upload: question-file kind skips the profile step', (
    tester,
  ) async {
    final library = FakeLibraryRepository()
      ..folders = [const Subject(id: 's1', name: 'أدوية', type: 'medical')];
    await pumpOne(
      tester,
      const BookUploadScreen(subjectId: 's1', questionFile: true),
      library: library,
      overrides: [
        questionFileRepositoryProvider.overrideWithValue(
          FakeQuestionFileRepository(),
        ),
      ],
    );
    await pumpFrames(tester);
    expect(find.text('نوع المادة'), findsNothing);
    expect(find.textContaining('لن يتم توليد أسئلة جديدة'), findsOneWidget);
    expect(find.text('استخراج الأسئلة'), findsOneWidget);
    await tester.tap(find.text('كتاب دراسي'));
    await pumpFrames(tester);
    expect(find.text('نوع المادة'), findsOneWidget);
  });
}
