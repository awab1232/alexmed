import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/ui/ui.dart';

import '../helpers/app_harness.dart';

void main() {
  testWidgets('signed out → lands on the welcome screen, RTL', (tester) async {
    await pumpNiroLearn(tester);
    expect(find.text('ذاكر بذكاء مع Niro'), findsOneWidget);
    expect(find.byType(NlBottomNav), findsNothing);
    final direction = Directionality.of(
      tester.element(find.text('ذاكر بذكاء مع Niro')),
    );
    expect(direction, TextDirection.rtl);
  });

  testWidgets(
    'signed in → Home with the 5-slot bar; tabs switch; ＋ is not a tab',
    (tester) async {
      await pumpNiroLearn(tester, session: signedIn);
      expect(find.byType(NlBottomNav), findsOneWidget);
      expect(find.text('مجلداتي'), findsOneWidget);

      await tester.tap(find.text('ألعاب'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, 'ألعاب'), findsOneWidget);

      await tester.tap(find.byTooltip('إضافة'));
      await tester.pumpAndSettle();
      // A sheet over Games — not a page.
      expect(find.text('ماذا تريد أن تضيف؟'), findsOneWidget);
      await tester.tapAt(const Offset(20, 20));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, 'ألعاب'), findsOneWidget);

      await tester.tap(find.text('حسابي'));
      await tester.pumpAndSettle();
      expect(find.text('الملف الدراسي'), findsOneWidget);
    },
  );
}
