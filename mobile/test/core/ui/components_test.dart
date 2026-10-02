import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:nirolearn/core/api/api_error.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/l10n/app_localizations.dart';

Widget host(Widget child, {Locale locale = const Locale('ar')}) {
  return MaterialApp(
    locale: locale,
    supportedLocales: AppLocalizations.supportedLocales,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    theme: buildNiroTheme(),
    home: Scaffold(body: child),
  );
}

void main() {
  group('NlButton', () {
    testWidgets('taps call onPressed; min height 48 (touch target)', (
      tester,
    ) async {
      var taps = 0;
      await tester.pumpWidget(
        host(
          Center(
            child: NlButton(label: 'دخول', onPressed: () => taps++),
          ),
        ),
      );
      await tester.tap(find.text('دخول'));
      expect(taps, 1);
      expect(
        tester.getSize(find.byType(NlButton)).height,
        greaterThanOrEqualTo(48),
      );
    });

    testWidgets('loading ignores taps and shows a spinner', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        host(
          Center(
            child: NlButton(
              label: 'حفظ',
              loading: true,
              onPressed: () => taps++,
            ),
          ),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.tap(find.text('حفظ'));
      expect(taps, 0);
    });

    testWidgets('secondary is at least 44 tall', (tester) async {
      await tester.pumpWidget(
        host(
          Center(
            child: NlButton(
              label: 'إلغاء',
              kind: NlButtonKind.secondary,
              onPressed: () {},
            ),
          ),
        ),
      );
      expect(
        tester.getSize(find.byType(NlButton)).height,
        greaterThanOrEqualTo(44),
      );
    });
  });

  group('NlRow', () {
    testWidgets('chevron points in reading direction (RTL ← / LTR →)', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          NlGroup(
            children: [NlRow(label: 'حسابي', onTap: () {})],
          ),
        ),
      );
      expect(find.byIcon(LucideIcons.chevronLeft), findsOneWidget);

      await tester.pumpWidget(
        host(
          NlGroup(
            children: [NlRow(label: 'Account', onTap: () {})],
          ),
          locale: const Locale('en'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byIcon(LucideIcons.chevronRight), findsOneWidget);
    });

    testWidgets('no chevron on rows without an action', (tester) async {
      await tester.pumpWidget(
        host(
          const NlGroup(
            children: [NlRow(label: 'نسخة التطبيق', value: '1.0')],
          ),
        ),
      );
      expect(find.byIcon(LucideIcons.chevronLeft), findsNothing);
      expect(find.text('1.0'), findsOneWidget);
    });
  });

  group('error text', () {
    testWidgets('localized per language; server Arabic text kept', (
      tester,
    ) async {
      late BuildContext ctx;
      await tester.pumpWidget(
        host(
          Builder(
            builder: (context) {
              ctx = context;
              return const SizedBox();
            },
          ),
          locale: const Locale('en'),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        apiErrorText(ctx, const NetworkException()),
        'Couldn\'t connect. Check your internet and try again.',
      );
      expect(
        apiErrorText(
          ctx,
          const RejectedException(
            'للتأكيد اكتب كلمة «حذف».',
            code: 'BAD_REQUEST',
          ),
        ),
        'للتأكيد اكتب كلمة «حذف».',
      );
    });

    testWidgets('NlErrorView shows the reason and a working retry', (
      tester,
    ) async {
      var retried = 0;
      await tester.pumpWidget(
        host(
          NlErrorView(
            error: const NetworkException(),
            onRetry: () => retried++,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('تعذّر التحميل'), findsOneWidget);
      expect(find.textContaining('تحقق من الإنترنت'), findsOneWidget);
      await tester.tap(find.text('أعد المحاولة'));
      expect(retried, 1);
    });
  });

  testWidgets('all Niro SVGs load (every expression + avatar)', (tester) async {
    await tester.pumpWidget(
      host(
        Wrap(
          children: [
            for (final e in NiroExpression.values)
              NiroImage(expression: e, size: 40),
            const NiroImage.avatar(),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(
      find.byType(NiroImage),
      findsNWidgets(NiroExpression.values.length + 1),
    );
  });

  testWidgets('bottom nav: marks the selected tab, ＋ is a separate action', (
    tester,
  ) async {
    var selected = -1;
    var added = 0;
    await tester.pumpWidget(
      host(
        Align(
          alignment: Alignment.bottomCenter,
          child: NlBottomNav(
            items: const [
              NlNavItem(icon: LucideIcons.house, label: 'الرئيسية'),
              NlNavItem(icon: LucideIcons.gamepad2, label: 'ألعاب'),
              NlNavItem(icon: LucideIcons.sparkles, label: 'Niro'),
              NlNavItem(icon: LucideIcons.user, label: 'حسابي'),
            ],
            selectedIndex: 0,
            onSelected: (i) => selected = i,
            addLabel: 'إضافة',
            addIcon: LucideIcons.plus,
            onAdd: () => added++,
          ),
        ),
      ),
    );
    await tester.tap(find.text('حسابي'));
    expect(selected, 3);
    await tester.tap(find.byTooltip('إضافة'));
    expect(added, 1);
    // RTL: the first tab (الرئيسية) sits on the right edge.
    final home = tester.getCenter(find.text('الرئيسية'));
    final account = tester.getCenter(find.text('حسابي'));
    expect(home.dx, greaterThan(account.dx));
  });
}
