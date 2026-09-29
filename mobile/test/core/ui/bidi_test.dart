import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/ui/bidi.dart';

void main() {
  group('isArabicText (same rule as the web)', () {
    test('Arabic sentence with an English medical term stays Arabic', () {
      expect(isArabicText('ما هو دور ACE inhibitor في علاج الضغط؟'), isTrue);
    });
    test('English text is not Arabic', () {
      expect(isArabicText('Which drug is a loop diuretic?'), isFalse);
    });
    test('mostly English with one Arabic word is not Arabic', () {
      expect(
        isArabicText('Furosemide is a loop diuretic (فوروسيميد)'),
        isFalse,
      );
    });
    test('no letters → not Arabic', () {
      expect(isArabicText('12 / 20'), isFalse);
      expect(isArabicText(''), isFalse);
    });
  });

  test('contentDirection', () {
    expect(contentDirection('ما هو دور ACE؟'), TextDirection.rtl);
    expect(contentDirection('Which vessel?'), TextDirection.ltr);
    expect(contentDirection('12 / 20'), isNull);
  });

  test('isolation marks wrap the run and nothing else', () {
    final wrapped = isolateLtr('079 123 4567');
    expect(wrapped.runes.first, 0x2066);
    expect(wrapped.runes.last, 0x2069);
    expect(
      String.fromCharCodes(
        wrapped.runes.toList().sublist(1, wrapped.runes.length - 1),
      ),
      '079 123 4567',
    );
    expect(isolate('ACE').runes.first, 0x2068);
  });

  testWidgets('AutoDirText lays English out LTR inside an RTL screen', (
    tester,
  ) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          children: [
            AutoDirText('Which drug is a loop diuretic?'),
            AutoDirText('أي دواء مدر عروي؟'),
            AutoDirText('12 / 20'),
          ],
        ),
      ),
    );
    TextDirection dirOf(String text) =>
        Directionality.of(tester.element(find.text(text)));
    expect(dirOf('Which drug is a loop diuretic?'), TextDirection.ltr);
    expect(dirOf('أي دواء مدر عروي؟'), TextDirection.rtl);
    expect(dirOf('12 / 20'), TextDirection.rtl); // inherits
  });
}
