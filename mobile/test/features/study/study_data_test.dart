import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/features/study/data/study_models.dart';
import 'package:nirolearn/features/study/data/study_preparation.dart';

import 'study_fakes.dart';

void main() {
  group('StudyContent (books.getStudyContent)', () {
    test('cards, questions, chapters and the manifest', () {
      final c = StudyContent.fromJson(studyJson());
      expect(c.title, 'Renal Physiology');
      expect(c.cards, hasLength(4));
      expect(c.mcqs, hasLength(4));
      // Arabic term from the chapter's terms (case-insensitive, same chapter).
      expect(c.cards.first.relatedTermAr, 'عروة هنلي');
      expect(c.cards.last.relatedTermAr, isNull); // c1 has no such term
      expect(c.cards.first.cardType, 'آلية');
      expect(c.mcqs[1].flagged, isTrue);
      expect(c.mcqs.first.questionType, 'تذكّر');
      expect(c.chapters.first.summarySections, hasLength(2));
      expect(c.manifest.outputs['mcqs']!.short, isTrue);
      expect(c.manifest.outputs['flashcards']!.short, isFalse);
    });

    test('missingFor: analysed chapters without cards / questions', () {
      final c = StudyContent.fromJson(
        studyJson(
          chapterStatuses: const ['complete', 'complete', 'pending'],
          cardChapters: const ['c0'],
        ),
      );
      expect(c.missingFor(StudyTool.cards).map((ch) => ch.id), ['c1']);
      expect(StudyTool.parse('explanation'), StudyTool.summary);
      expect(StudyTool.parse(null), StudyTool.cards);
    });
  });

  group('StudyPreparation (the web study page\'s steps)', () {
    const tick = Duration(milliseconds: 1);

    StudyPreparation prep(FakeStudyRepository repo, List<String> reloads) =>
        StudyPreparation(
          repo: repo,
          bookId: 'b1',
          tool: StudyTool.cards,
          onReload: () async => reloads.add('reload'),
          deckPoll: tick,
          deckResume: const Duration(milliseconds: 2),
          jobsPoll: tick,
        );

    test('no knowledge base → start it, wait, queue missing chapters, follow jobs, reload', () async {
      final repo =
          FakeStudyRepository(
              studyJson(
                chapterStatuses: const ['complete', 'complete'],
                cardChapters: const [],
              ),
            )
            ..decks = [
              null,
              deck('processing', done: 1),
              deck('processing', done: 3),
              deck('complete', done: 4),
            ]
            ..jobRounds = [
              const [
                GenerationJob(
                  chapterId: 'c0',
                  kind: 'flashcards',
                  status: 'processing',
                ),
                GenerationJob(
                  chapterId: 'c1',
                  kind: 'flashcards',
                  status: 'queued',
                ),
              ],
              const [
                GenerationJob(
                  chapterId: 'c0',
                  kind: 'flashcards',
                  status: 'completed',
                ),
                GenerationJob(
                  chapterId: 'c1',
                  kind: 'flashcards',
                  status: 'failed',
                ),
                // Another tool's job is ignored.
                GenerationJob(
                  chapterId: 'c1',
                  kind: 'mcqs',
                  status: 'processing',
                ),
              ],
            ];
      final reloads = <String>[];
      final p = prep(repo, reloads);
      final phases = <PrepPhase>[];
      p.state.addListener(() => phases.add(p.state.value.phase));
      await p.run(StudyContent.fromJson(repo.contentJson));

      expect(repo.calls.where((c) => c == 'startDeck'), hasLength(1));
      expect(
        repo.calls,
        containsAllInOrder(['generate:cards:c0', 'generate:cards:c1', 'jobs']),
      );
      expect(repo.calls, contains('resumeDeck'));
      expect(
        phases,
        containsAllInOrder([
          PrepPhase.knowledge,
          PrepPhase.generating,
          PrepPhase.done,
        ]),
      );
      expect(reloads, ['reload']);
      expect(p.state.value.errors, ['Chapter 2']);
      p.dispose();
    });

    test('nothing missing → nothing is called', () async {
      final repo = FakeStudyRepository(studyJson());
      final p = prep(repo, []);
      await p.run(StudyContent.fromJson(repo.contentJson));
      expect(repo.calls, isEmpty);
      p.dispose();
    });

    test('a shared book never starts generation (read-only)', () async {
      final repo = FakeStudyRepository(
        studyJson(role: 'shared', cardChapters: const []),
      );
      final p = prep(repo, []);
      await p.run(StudyContent.fromJson(repo.contentJson));
      expect(repo.calls, isEmpty);
      p.dispose();
    });

    test(
      'knowledge base can\'t start → generation continues (server fallback); '
      'a refused chapter is reported',
      () async {
        final repo = FakeStudyRepository(studyJson(cardChapters: const []))
          ..failStart = true
          ..failGenerateFor = {'c1'}
          ..jobRounds = [
            const [
              GenerationJob(
                chapterId: 'c0',
                kind: 'flashcards',
                status: 'completed',
              ),
            ],
          ];
        final reloads = <String>[];
        final p = prep(repo, reloads);
        await p.run(StudyContent.fromJson(repo.contentJson));
        expect(repo.calls, contains('generate:cards:c0'));
        expect(reloads, ['reload']);
        expect(p.state.value.errors, ['Chapter 2']);
        p.dispose();
      },
    );
  });
}
