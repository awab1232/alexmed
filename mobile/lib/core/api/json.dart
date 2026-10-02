// Tolerant readers for decoded API JSON. The server is the source of truth
// and may add fields at any time; these accept what is there, fall back
// where a field is optional, and throw (→ ServerException in TrpcClient)
// only when a required field is missing — never a crash deep in a widget.

typedef JsonMap = Map<String, Object?>;

JsonMap asMap(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) return value.cast<String, Object?>();
  throw const FormatException('expected an object');
}

List<JsonMap> asMapList(Object? value) {
  if (value is! List) throw const FormatException('expected a list');
  return [for (final item in value) asMap(item)];
}

extension JsonRead on JsonMap {
  String str(String key) {
    final value = this[key];
    if (value is String) return value;
    throw FormatException('missing string "$key"');
  }

  String? strOrNull(String key) {
    final value = this[key];
    return value is String ? value : null;
  }

  int integer(String key, {int fallback = 0}) {
    final value = this[key];
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? fallback;
    return fallback;
  }

  int? intOrNull(String key) {
    final value = this[key];
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }

  bool boolean(String key, {bool fallback = false}) {
    final value = this[key];
    return value is bool ? value : fallback;
  }

  /// superjson already turns Dates into DateTime; plain ISO strings are
  /// accepted too.
  DateTime? date(String key) {
    final value = this[key];
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value);
    return null;
  }
}
