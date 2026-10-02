import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

final _easternDigits = RegExp('[٠-٩]');

/// The web's formatDateTime (`ar-u-nu-latn`): day, short month, year, time,
/// with Latin digits — in the app's locale. The date symbols are loaded by
/// the Material localizations delegate. "—" for no date.
String formatDateTime(BuildContext context, DateTime? value) {
  if (value == null) return '—';
  final locale = Localizations.localeOf(context).toLanguageTag();
  final text = DateFormat.yMMMd(locale).add_jm().format(value.toLocal());
  return text.replaceAllMapped(
    _easternDigits,
    (m) => '${m[0]!.codeUnitAt(0) - 0x0660}',
  );
}
