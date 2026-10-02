import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/phone.dart';

// Mirrors the web's lib/phone.ts behaviour — same inputs, same outputs.
void main() {
  group('parsePhone', () {
    test('the ways a Jordanian student types their number', () {
      for (final input in [
        '0791234567',
        '079 123 4567',
        '79 123 4567',
        '+962 79 123 4567',
        '00962791234567',
        '962791234567',
        '٠٧٩١٢٣٤٥٦٧',
        '(079) 123-4567',
      ]) {
        expect(parsePhone(input), '+962791234567', reason: input);
      }
    });

    test('rejects non-mobile and wrong-length numbers', () {
      expect(parsePhone('0612345678'), isNull); // landline prefix
      expect(parsePhone('079123456'), isNull); // too short
      expect(parsePhone(''), isNull);
      expect(parsePhone('abc'), isNull);
      expect(parsePhone('+962 61 234 5678'), isNull);
    });

    test('other listed countries by selection or international form', () {
      expect(parsePhone('0501234567', 'SA'), '+966501234567');
      expect(parsePhone('+20 101 234 5678'), '+201012345678');
      expect(parsePhone('55123456', 'KW'), '+96555123456');
    });

    test('unlisted countries in international form pass the generic rule', () {
      expect(parsePhone('+4915123456789'), '+4915123456789');
      expect(parsePhone('+12'), isNull);
    });
  });

  test('looksLikePhone', () {
    expect(looksLikePhone('0791234567'), isTrue);
    expect(looksLikePhone('+962 79 123 4567'), isTrue);
    expect(looksLikePhone('٠٧٩١٢٣٤٥٦٧'), isTrue);
    expect(looksLikePhone('student@example.com'), isFalse);
    expect(looksLikePhone('12'), isFalse);
  });

  test('formatPhoneForDisplay', () {
    expect(formatPhoneForDisplay('+962791234567'), '+962 79 123 4567');
    expect(formatPhoneForDisplay('+96555123456'), '+965 5512 3456');
    expect(formatPhoneForDisplay('+4915123456789'), '+4915123456789');
  });
}
