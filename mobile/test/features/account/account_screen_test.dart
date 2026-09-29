import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';

import '../../helpers/app_harness.dart';

Future<void> openAccount(WidgetTester tester) async {
  await tester.tap(find.text('حسابي'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('groups as on the web; no admin, no upgrade button', (
    tester,
  ) async {
    await pumpNiroLearn(tester, session: signedIn);
    await openAccount(tester);
    for (final text in [
      'الحساب',
      'الملف الدراسي',
      'اسم المستخدم للمشاركة',
      'الباقة والاستخدام',
      'دراستي',
      'المساعدة',
      'سياسة الخصوصية',
      'تسجيل الخروج',
    ]) {
      expect(find.text(text), findsWidgets, reason: text);
    }
    expect(find.text('طب بشري، السنة الثالثة'), findsWidgets);
    expect(find.text('الإدارة'), findsNothing);
    expect(find.textContaining('الترقية'), findsNothing);
    expect(find.textContaining('+962 79 123 4567'), findsOneWidget);
  });

  testWidgets('doctor dashboard only for an approved doctor', (tester) async {
    final account = FakeAccountRepository()
      ..doctorSets = true
      ..doctor = const DoctorStatus(
        approved: true,
        applicationStatus: 'approved',
      );
    await pumpNiroLearn(tester, session: signedIn, account: account);
    await openAccount(tester);
    expect(find.text('الإدارة'), findsOneWidget);
    expect(find.text('لوحة الدكتور'), findsOneWidget);
    expect(find.text('انضم كدكتور'), findsNothing);
  });

  testWidgets('feature on, not a doctor → quiet apply link, no dashboard', (
    tester,
  ) async {
    final account = FakeAccountRepository()..doctorSets = true;
    await pumpNiroLearn(tester, session: signedIn, account: account);
    await openAccount(tester);
    await tester.scrollUntilVisible(find.text('انضم كدكتور'), 200);
    expect(find.text('لوحة الدكتور'), findsNothing);
  });

  testWidgets('feature off → doctor status is never requested', (tester) async {
    final account = FakeAccountRepository();
    await pumpNiroLearn(tester, session: signedIn, account: account);
    await openAccount(tester);
    expect(account.calls, isNot(contains('doctorStatus')));
  });

  testWidgets('edit the study profile', (tester) async {
    final account = FakeAccountRepository();
    await pumpNiroLearn(tester, session: signedIn, account: account);
    await openAccount(tester);
    await tester.tap(find.text('الملف الدراسي'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), 'السنة الرابعة');
    await tester.tap(find.widgetWithText(NlButton, 'حفظ'));
    await tester.pumpAndSettle();
    expect(account.calls, contains('updateProfile:السنة الرابعة:طب بشري'));
    expect(find.text('طب بشري، السنة الرابعة'), findsWidgets);
  });

  testWidgets('delete account: disabled until «حذف», then signed out', (
    tester,
  ) async {
    final account = FakeAccountRepository();
    final app = await pumpNiroLearn(
      tester,
      session: signedIn,
      account: account,
    );
    await openAccount(tester);
    await tester.tap(find.text('الملف الدراسي'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('حذف الحساب'));
    await tester.pumpAndSettle();

    final deleteButton = find.widgetWithText(NlButton, 'حذف نهائي');
    expect(tester.widget<NlButton>(deleteButton).onPressed, isNull);
    await tester.enterText(find.byType(TextField).last, 'delete');
    await tester.pump();
    expect(tester.widget<NlButton>(deleteButton).onPressed, isNull);
    await tester.enterText(find.byType(TextField).last, 'حذف');
    await tester.pump();
    await tester.tap(deleteButton);
    await tester.pumpAndSettle();

    expect(account.calls, contains('deleteAccount'));
    expect(app.store.current, isNull);
    expect(find.text('ذاكر بذكاء مع Niro'), findsOneWidget);
  });

  testWidgets('sign out asks first, then clears the session', (tester) async {
    final app = await pumpNiroLearn(tester, session: signedIn);
    await openAccount(tester);
    await tester.scrollUntilVisible(find.text('تسجيل الخروج'), 200);
    await tester.tap(find.text('تسجيل الخروج'));
    await tester.pumpAndSettle();
    expect(find.text('تسجيل الخروج؟'), findsOneWidget);
    await tester.tap(find.widgetWithText(NlButton, 'إلغاء'));
    await tester.pumpAndSettle();
    expect(app.store.current, isNotNull);

    await tester.tap(find.text('تسجيل الخروج'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(NlButton, 'تسجيل الخروج'));
    await tester.pumpAndSettle();
    expect(app.store.current, isNull);
    expect(find.text('ذاكر بذكاء مع Niro'), findsOneWidget);
  });

  testWidgets('plan screen: usage, read-only', (tester) async {
    await pumpNiroLearn(tester, session: signedIn);
    await openAccount(tester);
    await tester.tap(find.text('الباقة والاستخدام'));
    await tester.pumpAndSettle();
    expect(find.text('أنت تستخدم الباقة المجانية.'), findsOneWidget);
    expect(find.text('3 من 20'), findsOneWidget);
    expect(find.text('1 من 1'), findsOneWidget);
    expect(find.textContaining('الترقية'), findsNothing);
    expect(find.textContaining('Pro'), findsNothing);
  });

  test('billing.mine parsing (server shape)', () {
    final plan = PlanSummary.fromJson({
      'plan': {'id': 'pro', 'name': 'Pro', 'assistantDailyLimit': 200},
      'subscription': {
        'planId': 'pro',
        'status': 'active',
        'endDate': DateTime.utc(2026, 12, 1),
      },
      'assistant': {'used': 5, 'limit': 200, 'remaining': 195},
      'questions': {
        'daily': {'used': 1, 'limit': null, 'remaining': null},
        'monthly': {'used': 3, 'limit': 100, 'remaining': 97},
      },
      'books': {
        'daily': {'used': 0, 'limit': 5, 'remaining': 5},
        'monthly': {'used': 0, 'limit': 50, 'remaining': 50},
      },
      'maxFileSizeMb': 100,
      'requests': <Object>[],
      'pendingRequest': null,
      'phone': null,
    });
    expect(plan.planName, 'Pro');
    expect(plan.subscribed, isTrue);
    expect(plan.endsAt, DateTime.utc(2026, 12, 1));
    expect(plan.questionFiles.limit, isNull); // unlimited
    expect(plan.studyFiles.limit, 5);
    expect(plan.maxFileSizeMb, 100);
  });

  testWidgets('Android back: other tab root → Home; Home root → leaves', (
    tester,
  ) async {
    await pumpNiroLearn(tester, session: signedIn);
    await openAccount(tester);
    expect(find.text('الملف الدراسي'), findsOneWidget);
    final handled = await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(handled, isTrue);
    expect(find.text('مجلداتي'), findsOneWidget);
    expect(find.byType(NlBottomNav), findsOneWidget);
  });
}
