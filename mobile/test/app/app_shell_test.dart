import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/core/ui/ui.dart';

Future<void> pumpApp(WidgetTester tester) async {
  await tester.pumpWidget(const ProviderScope(child: NiroLearnApp()));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('signed out → lands on the welcome screen, RTL', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});
    await pumpApp(tester);
    expect(find.text('ذاكر بذكاء مع Niro'), findsOneWidget);
    expect(find.byType(NlBottomNav), findsNothing);
    final direction = Directionality.of(
      tester.element(find.text('ذاكر بذكاء مع Niro')),
    );
    expect(direction, TextDirection.rtl);
  });

  testWidgets('signed in → Home with the 5-slot bar; ＋ is not a tab', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({
      'nl.session.token': 'tok',
      'nl.session.expiresAt': '2099-01-01T00:00:00.000Z',
    });
    await pumpApp(tester);
    expect(find.byType(NlBottomNav), findsOneWidget);
    expect(find.widgetWithText(AppBar, 'الرئيسية'), findsOneWidget);

    await tester.tap(find.text('ألعاب'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'ألعاب'), findsOneWidget);

    await tester.tap(find.byTooltip('إضافة'));
    await tester.pumpAndSettle();
    // Still on Games — the add action opens a sheet (phase 5), not a page.
    expect(find.widgetWithText(AppBar, 'ألعاب'), findsOneWidget);

    await tester.tap(find.text('حسابي'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'حسابي'), findsOneWidget);
  });
}
