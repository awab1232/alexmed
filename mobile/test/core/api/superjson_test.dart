import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/core/api/superjson.dart';

// Payloads below are exactly what the server's superjson 1.13.3 produced
// (captured 2026-09-29 with `S.serialize(...)` in the web repo).
Object? decode(String payload) {
  final map = jsonDecode(payload) as Map<String, Object?>;
  return superjsonDecode(map['json'], map['meta']);
}

void main() {
  group('superjsonDecode', () {
    test('Date inside an object', () {
      final value =
          decode(
                '{"json":{"a":"2026-09-29T10:00:00.000Z","n":1},'
                '"meta":{"values":{"a":["Date"]}}}',
              )!
              as Map;
      expect(value['a'], DateTime.utc(2026, 9, 29, 10));
      expect(value['n'], 1);
    });

    test('Dates in arrays of objects, undefined, null untouched', () {
      final value =
          decode(
                '{"json":{"items":[{"when":"1970-01-01T00:00:00.000Z","x":null},'
                '{"when":"1970-01-01T00:00:01.000Z"}],"u":null},'
                '"meta":{"values":{"items.0.when":["Date"],'
                '"items.1.when":["Date"],"u":["undefined"]}}}',
              )!
              as Map;
      final items = value['items'] as List;
      expect((items[0] as Map)['when'], DateTime.utc(1970));
      expect((items[0] as Map)['x'], isNull);
      expect((items[1] as Map)['when'], DateTime.utc(1970, 1, 1, 0, 0, 1));
      expect(value['u'], isNull);
    });

    test('root-level annotations', () {
      expect(
        decode(
          '{"json":"1970-01-01T00:00:00.005Z","meta":{"values":["Date"]}}',
        ),
        DateTime.utc(1970, 1, 1, 0, 0, 0, 5),
      );
      expect(
        decode('{"json":"10","meta":{"values":["bigint"]}}'),
        BigInt.from(10),
      );
      expect(decode('{"json":[["k",1]],"meta":{"values":["map"]}}'), {'k': 1});
      expect(decode('{"json":[1],"meta":{"values":["set"]}}'), {1});
    });

    test('array root', () {
      final value =
          decode(
                '{"json":["1970-01-01T00:00:00.000Z"],"meta":{"values":{"0":["Date"]}}}',
              )!
              as List;
      expect(value.single, DateTime.utc(1970));
    });

    test('no meta leaves plain JSON as is', () {
      expect(decode('{"json":{"a":"2026-09-29T10:00:00.000Z"}}'), {
        'a': '2026-09-29T10:00:00.000Z',
      });
    });

    test('an annotation for a missing path is ignored, never throws', () {
      expect(decode('{"json":{"a":1},"meta":{"values":{"b.c":["Date"]}}}'), {
        'a': 1,
      });
    });

    test('nested annotation inside a Map', () {
      final value =
          decode(
                '{"json":{"m":[["k","1970-01-01T00:00:00.000Z"]]},'
                '"meta":{"values":{"m":["map",{"0.1":["Date"]}]}}}',
              )!
              as Map;
      expect(value['m'], {'k': DateTime.utc(1970)});
    });

    test('escaped dot in a key', () {
      final value =
          decode(
                r'{"json":{"a.b":"1970-01-01T00:00:00.000Z"},"meta":{"values":{"a\\.b":["Date"]}}}',
              )!
              as Map;
      expect(value['a.b'], DateTime.utc(1970));
    });
  });

  group('superjsonEncode', () {
    test('plain input has no meta', () {
      expect(superjsonEncode({'name': 'x'}), {
        'json': {'name': 'x'},
      });
    });

    test('DateTime becomes ISO string + Date annotation', () {
      expect(
        superjsonEncode({
          'startsAt': DateTime.utc(2026, 10, 1, 8),
          'list': [DateTime.utc(1970)],
        }),
        {
          'json': {
            'startsAt': '2026-10-01T08:00:00.000Z',
            'list': ['1970-01-01T00:00:00.000Z'],
          },
          'meta': {
            'values': {
              'startsAt': ['Date'],
              'list.0': ['Date'],
            },
          },
        },
      );
    });

    test('round trip', () {
      final input = {
        'when': DateTime.utc(2026, 9, 29),
        'nested': {
          'at': [DateTime.utc(2020)],
        },
      };
      final wire = jsonDecode(jsonEncode(superjsonEncode(input))) as Map;
      expect(superjsonDecode(wire['json'], wire['meta']), input);
    });

    test('null input', () {
      expect(superjsonEncode(null), {'json': null});
    });
  });
}
