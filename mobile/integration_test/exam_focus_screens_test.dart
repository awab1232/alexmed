// Visual check of Exam Focus (progress, cards, filters, search) on a device
// with in-memory data (no server).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/app/router.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/auth/data/auth_repository.dart';
import 'package:nirolearn/features/exam_focus/data/exam_focus_models.dart';
import 'package:nirolearn/features/exam_focus/data/exam_focus_repository.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';

import '../test/features/exam_focus/exam_focus_screen_test.dart'
    show FakeExamFocusRepository, readyDeck;
import '../test/helpers/app_harness.dart';
import '../test/helpers/fake_http.dart';

Future<void> hold(WidgetTester tester, String label) async {
  debugPrint('SCREEN $label');
  for (var i = 0; i < 40; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

const _cards = [
  ExamFocusCard(
    id: 'a',
    category: 'emergency',
    topic: 'Chemical burns',
    title: 'Irrigate immediately with copious water',
    points: [
      'Start irrigation within 1 min of exposure',
      'Continue for 15–30 minutes (alkali: up to 2 hours)',
      'Check pH until 7.0–7.4 before stopping',
    ],
    highlightLabel: 'KEY POINT',
    highlightText:
        'Never neutralise — dilution only; > 20% TBSA needs a burn centre',
    flag: 'Source table was partly unreadable.',
    sourcePages: [12, 13],
  ),
  ExamFocusCard(
    id: 'b',
    category: 'drug_dose',
    topic: 'Analgesia',
    title: 'Paracetamol dose in children',
    points: ['15 mg/kg every 6 hours', 'Max 60 mg/kg/day'],
    sourcePages: [21],
  ),
  ExamFocusCard(
    id: 'c',
    category: 'high_yield',
    title: 'Rule of nines',
    points: ['Each arm 9%', 'Each leg 18%'],
    sourcePages: [5],
  ),
];

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('exam focus screens', (tester) async {
    final ef = FakeExamFocusRepository()
      ..decks = [
        const ExamFocusDeck(
          status: 'processing',
          units: [
            ExamFocusUnit(
              id: '1',
              pageStart: 1,
              pageEnd: 12,
              status: 'complete',
              factCount: 18,
            ),
            ExamFocusUnit(
              id: '2',
              pageStart: 13,
              pageEnd: 24,
              status: 'complete',
              factCount: 11,
            ),
            ExamFocusUnit(
              id: '3',
              pageStart: 25,
              pageEnd: 36,
              status: 'processing',
            ),
            ExamFocusUnit(
              id: '4',
              pageStart: 37,
              pageEnd: 48,
              status: 'pending',
            ),
          ],
        ),
      ];
    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(FakeLibraryRepository()),
          accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
          examFocusRepositoryProvider.overrideWithValue(ef),
        ],
        child: const NiroLearnApp(),
      ),
    );
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
    final router = ProviderScope.containerOf(
      tester.element(find.byType(NlBottomNav)),
    ).read(routerProvider);

    unawaited(router.push(Routes.bookExamFocus('b1')));
    await hold(tester, 'progress');
    router.pop();

    ef
      ..decks = [
        ExamFocusDeck(
          status: 'complete',
          totalCards: 3,
          units: readyDeck().units,
          categoryCounts: const {
            'emergency': 1,
            'drug_dose': 1,
            'high_yield': 1,
          },
          bookmarkedCount: 1,
        ),
      ]
      ..all = _cards;
    unawaited(router.push(Routes.bookExamFocus('b1')));
    await hold(tester, 'card');
    await tester.tap(find.byTooltip('احفظ للمراجعة لاحقًا'));
    await tester.tap(find.text('التالي'));
    await hold(tester, 'card-dose');
    await tester.tap(find.byTooltip('بحث في البطاقات'));
    await hold(tester, 'search');
  });
}
