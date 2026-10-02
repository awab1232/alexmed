// Mobile numbers for phone sign-up / login — a line-for-line port of the
// web's lib/phone.ts, so the app accepts exactly what the server accepts.
// Everything sent is E.164 ("+962791234567"). The server re-validates; this
// only lets the form say "wrong number" before a round-trip.

final class PhoneCountry {
  const PhoneCountry({
    required this.iso,
    required this.dial,
    required this.nameAr,
    required this.flag,
    required this.length,
    required this.mobilePrefixes,
    required this.example,
  });

  final String iso;

  /// Without "+".
  final String dial;
  final String nameAr;
  final String flag;

  /// National significant number length (no trunk "0").
  final int length;
  final List<String> mobilePrefixes;

  /// National form shown as the placeholder.
  final String example;
}

const phoneCountries = <PhoneCountry>[
  PhoneCountry(
    iso: 'JO',
    dial: '962',
    nameAr: 'الأردن',
    flag: '🇯🇴',
    length: 9,
    mobilePrefixes: ['77', '78', '79'],
    example: '07X XXX XXXX',
  ),
  PhoneCountry(
    iso: 'SA',
    dial: '966',
    nameAr: 'السعودية',
    flag: '🇸🇦',
    length: 9,
    mobilePrefixes: ['5'],
    example: '05X XXX XXXX',
  ),
  PhoneCountry(
    iso: 'AE',
    dial: '971',
    nameAr: 'الإمارات',
    flag: '🇦🇪',
    length: 9,
    mobilePrefixes: ['50', '52', '54', '55', '56', '58'],
    example: '05X XXX XXXX',
  ),
  PhoneCountry(
    iso: 'KW',
    dial: '965',
    nameAr: 'الكويت',
    flag: '🇰🇼',
    length: 8,
    mobilePrefixes: ['4', '5', '6', '9'],
    example: '5XXX XXXX',
  ),
  PhoneCountry(
    iso: 'QA',
    dial: '974',
    nameAr: 'قطر',
    flag: '🇶🇦',
    length: 8,
    mobilePrefixes: ['3', '5', '6', '7'],
    example: '3XXX XXXX',
  ),
  PhoneCountry(
    iso: 'BH',
    dial: '973',
    nameAr: 'البحرين',
    flag: '🇧🇭',
    length: 8,
    mobilePrefixes: ['3', '6'],
    example: '3XXX XXXX',
  ),
  PhoneCountry(
    iso: 'OM',
    dial: '968',
    nameAr: 'عُمان',
    flag: '🇴🇲',
    length: 8,
    mobilePrefixes: ['7', '9'],
    example: '9XXX XXXX',
  ),
  PhoneCountry(
    iso: 'PS',
    dial: '970',
    nameAr: 'فلسطين',
    flag: '🇵🇸',
    length: 9,
    mobilePrefixes: ['56', '59'],
    example: '059 XXX XXXX',
  ),
  PhoneCountry(
    iso: 'LB',
    dial: '961',
    nameAr: 'لبنان',
    flag: '🇱🇧',
    length: 8,
    mobilePrefixes: ['3', '70', '71', '76', '78', '79', '81'],
    example: '03 XXX XXX',
  ),
  PhoneCountry(
    iso: 'SY',
    dial: '963',
    nameAr: 'سوريا',
    flag: '🇸🇾',
    length: 9,
    mobilePrefixes: ['9'],
    example: '09XX XXX XXX',
  ),
  PhoneCountry(
    iso: 'IQ',
    dial: '964',
    nameAr: 'العراق',
    flag: '🇮🇶',
    length: 10,
    mobilePrefixes: ['7'],
    example: '07XX XXX XXXX',
  ),
  PhoneCountry(
    iso: 'EG',
    dial: '20',
    nameAr: 'مصر',
    flag: '🇪🇬',
    length: 10,
    mobilePrefixes: ['10', '11', '12', '15'],
    example: '01X XXXX XXXX',
  ),
];

const defaultPhoneCountry = 'JO';

/// ٠-٩ (U+0660…) and ۰-۹ (U+06F0…) → 0-9.
String toAsciiDigits(String input) {
  final out = StringBuffer();
  for (final rune in input.runes) {
    if (rune >= 0x0660 && rune <= 0x0669) {
      out.write(rune - 0x0660);
    } else if (rune >= 0x06F0 && rune <= 0x06F9) {
      out.write(rune - 0x06F0);
    } else {
      out.writeCharCode(rune);
    }
  }
  return out.toString();
}

PhoneCountry? findCountry(String iso) {
  for (final country in phoneCountries) {
    if (country.iso == iso) return country;
  }
  return null;
}

bool _isValidNational(PhoneCountry country, String national) =>
    national.length == country.length &&
    country.mobilePrefixes.any(national.startsWith);

/// E.164 number, or null when the input isn't a valid mobile number.
/// Accepts "0791234567", "79 123 4567", "+962 79 123 4567",
/// "00962791234567", "٠٧٩١٢٣٤٥٦٧" for the selected country, or a full
/// international number for any country.
String? parsePhone(String input, [String countryIso = defaultPhoneCountry]) {
  final cleaned = toAsciiDigits(input).replaceAll(RegExp(r'[\s\-().]'), '');
  if (cleaned.isEmpty) return null;

  String? international;
  if (cleaned.startsWith('+')) {
    international = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    international = cleaned.substring(2);
  }
  if (international != null) {
    if (!RegExp(r'^\d{8,15}$').hasMatch(international)) return null;
    final digits = international;
    for (final country in phoneCountries) {
      if (digits.startsWith(country.dial)) {
        final national = digits
            .substring(country.dial.length)
            .replaceFirst(RegExp('^0'), '');
        return _isValidNational(country, national)
            ? '+${country.dial}$national'
            : null;
      }
    }
    return '+$digits';
  }

  if (!RegExp(r'^\d+$').hasMatch(cleaned)) return null;
  final country = findCountry(countryIso);
  if (country == null) return null;
  var national = cleaned;
  // The student typed the country code without "+" (962791234567).
  if (national.startsWith(country.dial) &&
      national.length > country.length + 1) {
    national = national.substring(country.dial.length);
  }
  national = national.replaceFirst(RegExp('^0'), '');
  return _isValidNational(country, national)
      ? '+${country.dial}$national'
      : null;
}

/// True when a login identifier is a phone number rather than an email.
bool looksLikePhone(String identifier) {
  final value = toAsciiDigits(identifier).trim();
  return !value.contains('@') &&
      RegExp(r'^[+\d][\d\s\-().]{5,}$').hasMatch(value);
}

/// "+962791234567" → "+962 79 123 4567".
String formatPhoneForDisplay(String e164) {
  PhoneCountry? country;
  for (final c in phoneCountries) {
    if (e164.startsWith('+${c.dial}')) {
      country = c;
      break;
    }
  }
  if (country == null) return e164;
  final national = e164.substring(country.dial.length + 1);
  final sizes = national.length == 8
      ? [4, 4]
      : national.length >= 9
      ? [national.length - 7, 3, 4]
      : [national.length];
  final parts = <String>[];
  var at = 0;
  for (final size in sizes) {
    parts.add(national.substring(at, at + size));
    at += size;
  }
  return '+${country.dial} ${parts.join(' ')}';
}
