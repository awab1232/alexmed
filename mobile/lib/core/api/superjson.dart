// superjson (v1.13, the version the NiroLearn server runs) — the wire
// format tRPC uses for every request and response.
//
// A payload is `{"json": <plain JSON>, "meta": {"values": <annotations>}}`.
// Annotations say which values were not plain JSON before serialising:
//
//   root value      "values": ["Date"]
//   inside objects  "values": {"items.0.when": ["Date"], "u": ["undefined"]}
//   nested inside   ["map", {"0.1": ["Date"]}]  (a Map holding Dates)
//
// Supported: Date → DateTime (UTC), undefined → null, bigint → BigInt,
// map → Map, set → Set, number (NaN / ±Infinity) → double. Anything else is
// left as its plain JSON form rather than guessed at.

typedef Json = Object?;

/// Decodes a superjson payload's `json` using its `meta`.
Json superjsonDecode(Json json, Json meta) {
  final Object? values = meta is Map ? meta['values'] : null;
  if (values == null) return json;
  return _applyAnnotations(json, values);
}

/// Encodes a request input as a superjson payload (`{"json": …, "meta": …}`).
/// Only DateTime needs annotating in NiroLearn's inputs.
Map<String, Object?> superjsonEncode(Json input) {
  final annotations = <String, List<String>>{};
  final json = _encodeValue(input, const [], annotations);
  return {
    'json': json,
    if (annotations.isNotEmpty)
      'meta': {
        'values': annotations.length == 1 && annotations.containsKey('')
            ? annotations['']
            : annotations,
      },
  };
}

Json _applyAnnotations(Json json, Object values) {
  if (values is List) return _transform(json, values);
  if (values is! Map) return json;
  var root = json;
  for (final entry in values.entries) {
    final annotation = entry.value;
    if (annotation is! List) continue;
    final path = _splitPath(entry.key as String);
    if (path.isEmpty) {
      root = _transform(root, annotation);
      continue;
    }
    _replaceAt(root, path, (value) => _transform(value, annotation));
  }
  return root;
}

// ["Date"] / ["map", {subtree}] — the subtree annotates values inside this
// one (in its plain JSON form), so it is applied first.
Json _transform(Json value, List<Object?> annotation) {
  if (annotation.isEmpty) return value;
  final type = annotation.first;
  if (annotation.length > 1 && annotation[1] is Map && type != 'class') {
    value = _applyAnnotations(value, annotation[1] as Object);
  }
  switch (type) {
    case 'Date':
      return value is String ? DateTime.parse(value).toUtc() : value;
    case 'undefined':
      return null;
    case 'bigint':
      return value is String ? BigInt.tryParse(value) ?? value : value;
    case 'map':
      if (value is! List) return value;
      return {
        for (final pair in value)
          if (pair is List && pair.length == 2) pair[0]: pair[1],
      };
    case 'set':
      return value is List ? value.toSet() : value;
    case 'number':
      return switch (value) {
        'NaN' => double.nan,
        'Infinity' => double.infinity,
        '-Infinity' => double.negativeInfinity,
        _ => value,
      };
    default:
      return value;
  }
}

// "items.0.when" → ["items", "0", "when"]; a key containing a dot is sent
// escaped as "a\.b".
List<String> _splitPath(String path) {
  if (path.isEmpty) return const [];
  final parts = <String>[];
  final current = StringBuffer();
  for (var i = 0; i < path.length; i++) {
    final char = path[i];
    if (char == r'\' && i + 1 < path.length && path[i + 1] == '.') {
      current.write('.');
      i++;
    } else if (char == '.') {
      parts.add(current.toString());
      current.clear();
    } else {
      current.write(char);
    }
  }
  parts.add(current.toString());
  return parts;
}

void _replaceAt(Json root, List<String> path, Json Function(Json) update) {
  Json parent = root;
  for (var i = 0; i < path.length - 1; i++) {
    parent = _child(parent, path[i]);
    if (parent == null) return;
  }
  final last = path.last;
  if (parent is Map) {
    if (parent.containsKey(last)) parent[last] = update(parent[last]);
  } else if (parent is List) {
    final index = int.tryParse(last);
    if (index != null && index >= 0 && index < parent.length) {
      parent[index] = update(parent[index]);
    }
  }
}

Json _child(Json container, String key) {
  if (container is Map) return container[key];
  if (container is List) {
    final index = int.tryParse(key);
    if (index != null && index >= 0 && index < container.length) {
      return container[index];
    }
  }
  return null;
}

Json _encodeValue(
  Json value,
  List<String> path,
  Map<String, List<String>> annotations,
) {
  if (value is DateTime) {
    annotations[path.map((p) => p.replaceAll('.', r'\.')).join('.')] = ['Date'];
    return value.toUtc().toIso8601String();
  }
  if (value is Map) {
    return {
      for (final entry in value.entries)
        entry.key.toString(): _encodeValue(entry.value, [
          ...path,
          entry.key.toString(),
        ], annotations),
    };
  }
  if (value is List) {
    return [
      for (var i = 0; i < value.length; i++)
        _encodeValue(value[i], [...path, '$i'], annotations),
    ];
  }
  return value;
}
