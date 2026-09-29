import 'package:nirolearn/features/exam_focus/data/exam_focus_models.dart';
import 'package:nirolearn/features/study/data/study_models.dart';
import 'package:nirolearn/features/study/data/study_repository.dart';

/// getStudyContent as the server returns it (after superjson decoding).
Map<String, Object?> studyJson({
  List<String> chapterStatuses = const ['complete', 'complete'],
  int cardsPerChapter = 2,
  int mcqsPerChapter = 2,
  String role = 'owner',
  List<String>? cardChapters,
}) {
  final chapters = [
    for (final (i, s) in chapterStatuses.indexed)
      {
        'id': 'c$i',
        'orderIndex': i,
        'title': 'Chapter ${i + 1}',
        'startPage': i * 10 + 1,
        'endPage': (i + 1) * 10,
        'status': s,
        'chapterSummary': 'Summary of chapter ${i + 1}.',
        'explanationEn': 'English explanation ${i + 1}.',
        'explanationAr': 'شرح عربي ${i + 1}.',
        'keyPoints': ['Point A${i + 1}', 'Point B${i + 1}'],
        'medicalNotePages': null,
        'coverageManifest': {
          'summarySections': [
            {
              'chunkId': 'k${i}a',
              'pageStart': i * 10 + 1,
              'pageEnd': i * 10 + 5,
              'summary': 'First half.',
            },
            {
              'chunkId': 'k${i}b',
              'pageStart': i * 10 + 6,
              'pageEnd': (i + 1) * 10,
              'summary': 'Second half.',
            },
          ],
        },
      },
  ];
  final withCards =
      cardChapters ??
      [
        for (final (i, s) in chapterStatuses.indexed)
          if (s == 'complete') 'c$i',
      ];
  return {
    'book': {'id': 'b1', 'fileName': 'Renal_Physiology.pdf', 'pageCount': 20},
    'chapters': chapters,
    'cards': [
      for (final c in withCards)
        for (var n = 0; n < cardsPerChapter; n++)
          {
            'id': '$c-card$n',
            'chapterId': c,
            'questionEn': 'What does the loop of Henle do? ($c/$n)',
            'questionAr': 'ما وظيفة عروة هنلي؟ ($c/$n)',
            'answerEn': 'Concentrates urine ($c/$n)',
            'answerAr': 'تركيز البول ($c/$n)',
            'relatedTermEn': 'Loop of Henle',
            'sourcePage': 3,
            'cardType': 'mechanism',
          },
    ],
    'mcqs': [
      for (final c in withCards)
        for (var n = 0; n < mcqsPerChapter; n++)
          {
            'id': '$c-mcq$n',
            'chapterId': c,
            'questionEn': 'Which segment reabsorbs most sodium? ($c/$n)',
            'choices': [
              'Proximal tubule',
              'Loop of Henle',
              'Distal tubule',
              'Collecting duct',
            ],
            'correctIndex': 0,
            'explanationEn': 'About 65% is reabsorbed proximally.',
            'sourcePage': 4,
            'validationStatus': n == 1 ? 'flagged' : 'valid',
            'validationNote': n == 1 ? 'Check the percentage' : null,
            'questionType': 'recall',
          },
    ],
    'terms': [
      {'chapterId': 'c0', 'en': 'loop of henle', 'ar': 'عروة هنلي'},
    ],
    'manifest': {
      'totalPages': 20,
      'extractedPages': 20,
      'failedPages': <int>[],
      'outputs': {
        'flashcards': {
          'chaptersGenerated': 2,
          'coveredChunks': 4,
          'requiredChunks': 4,
          'status': 'COMPLETE',
        },
        'mcqs': {
          'chaptersGenerated': 2,
          'coveredChunks': 3,
          'requiredChunks': 4,
          'status': 'PARTIAL',
        },
      },
    },
    'access': {'role': role, 'ownerName': null, 'ownerUsername': null},
  };
}

class FakeStudyRepository implements StudyRepository {
  FakeStudyRepository(this.contentJson);

  Map<String, Object?> contentJson;
  final calls = <String>[];

  /// Scripted examFocus.get answers (last one repeats).
  List<ExamFocusDeck?> decks = [null];
  int _deck = 0;
  bool failStart = false;

  /// Scripted generationJobs answers (last one repeats).
  List<List<GenerationJob>> jobRounds = [const []];
  int _jobs = 0;
  Set<String> failGenerateFor = {};
  bool correctAnswers = true;

  @override
  Future<StudyContent> content(String bookId) async {
    calls.add('content');
    return StudyContent.fromJson(contentJson);
  }

  @override
  Future<void> rateCard(String cardId, CardRating rating) async =>
      calls.add('rate:$cardId:${rating.name}');

  @override
  Future<McqResult> submitMcq(String mcqId, int selectedIndex) async {
    calls.add('submit:$mcqId:$selectedIndex');
    return McqResult(
      isCorrect: selectedIndex == 0,
      correctIndex: 0,
      explanationEn: 'About 65% is reabsorbed proximally.',
    );
  }

  @override
  Future<void> generate(StudyTool tool, String chapterId) async {
    calls.add('generate:${tool.name}:$chapterId');
    if (failGenerateFor.contains(chapterId)) throw Exception('refused');
  }

  @override
  Future<void> composeNotes(String chapterId) async =>
      calls.add('compose:$chapterId');

  @override
  Future<List<GenerationJob>> jobs(String bookId) async {
    calls.add('jobs');
    final round = jobRounds[_jobs.clamp(0, jobRounds.length - 1)];
    _jobs++;
    return round;
  }

  @override
  Future<ExamFocusDeck?> examFocus(String bookId) async {
    calls.add('deck');
    final deck = decks[_deck.clamp(0, decks.length - 1)];
    _deck++;
    return deck;
  }

  @override
  Future<void> startExamFocus(String bookId) async {
    calls.add('startDeck');
    if (failStart) throw Exception('cannot');
  }

  @override
  Future<void> resumeExamFocus(String bookId) async => calls.add('resumeDeck');

  @override
  Future<String?> pageImageUrl(String bookId, int page) async => null;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

ExamFocusDeck deck(String status, {int done = 0, int total = 4}) =>
    ExamFocusDeck(
      status: status,
      units: [
        for (var i = 0; i < total; i++)
          ExamFocusUnit(
            id: 'u$i',
            pageStart: i * 5 + 1,
            pageEnd: i * 5 + 5,
            status: i < done ? 'complete' : 'processing',
          ),
      ],
    );
