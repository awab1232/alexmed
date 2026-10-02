import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/trpc_client.dart' show apiExceptionFromDio;

/// Reads one protected PDF in byte ranges through the server's same-origin
/// proxy (`/api/files/{key}?stream=1` — the web reader's own path). The
/// server checks the session and the user's access to the key on every
/// request and fetches from storage itself, so the signed storage URL never
/// reaches the device and the session never goes to storage.
///
/// Nothing is written to disk: chunks live in a bounded in-memory LRU for
/// as long as the reader is open, then [dispose] drops them. Opening the
/// same book again fetches only the pages it shows.
class PdfRangeSource {
  PdfRangeSource({
    required this.dio,
    required String fileKey,
    this.chunkSize = 512 * 1024,
    this.maxCachedBytes = 48 * 1024 * 1024,
    this.maxAttempts = 3,
    Duration Function(int attempt)? backoff,
  }) : _path = fileStreamPath(fileKey),
       _backoff = backoff ?? ((a) => Duration(milliseconds: 400 * a));

  final Dio dio;
  final String _path;
  final int chunkSize;
  final int maxCachedBytes;
  final int maxAttempts;
  final Duration Function(int attempt) _backoff;

  final _cache = <int, Uint8List>{}; // insertion order = LRU order
  final _inFlight = <int, Future<Uint8List>>{};
  final _cancel = CancelToken();
  int _cachedBytes = 0;
  int? _size;

  /// Bytes fetched from the network so far (for the performance check).
  int bytesFetched = 0;

  int get size => _size ?? (throw StateError('open() first'));

  /// `/api/files/<key segments>?stream=1` — each segment URL-encoded; the
  /// key itself is never shown or logged.
  static String fileStreamPath(String fileKey) =>
      '/api/files/${fileKey.split('/').map(Uri.encodeComponent).join('/')}'
      '?stream=1';

  /// Learns the file size from a one-byte range request (`Content-Range`).
  Future<int> open() async {
    final response = await _get('bytes=0-0');
    final total = _totalFromContentRange(
      response.headers.value('content-range'),
    );
    if (total == null || total <= 0) throw const ServerException();
    _size = total;
    return total;
  }

  /// pdfrx's read callback: fills [buffer] from [position], returns the
  /// number of bytes written.
  Future<int> read(Uint8List buffer, int position, int size) async {
    final total = this.size;
    if (position >= total) return 0;
    final end = math.min(position + size, total);
    var written = 0;
    var offset = position;
    while (offset < end) {
      final index = offset ~/ chunkSize;
      final chunk = await _chunk(index);
      final start = offset - index * chunkSize;
      final take = math.min(chunk.length - start, end - offset);
      if (take <= 0) break;
      buffer.setRange(written, written + take, chunk, start);
      written += take;
      offset += take;
    }
    return written;
  }

  Future<Uint8List> _chunk(int index) {
    final cached = _cache.remove(index);
    if (cached != null) {
      _cache[index] = cached; // most recently used
      return Future.value(cached);
    }
    // The callback must not return the removed future: whenComplete would
    // then wait for itself and never finish.
    return _inFlight[index] ??= _fetchChunk(index).whenComplete(() {
      _inFlight.remove(index);
    });
  }

  Future<Uint8List> _fetchChunk(int index) async {
    final from = index * chunkSize;
    final to = math.min(from + chunkSize, size) - 1;
    final response = await _get('bytes=$from-$to');
    final data = response.data;
    if (data == null) throw const ServerException();
    final bytes = Uint8List.fromList(data);
    bytesFetched += bytes.length;
    _remember(index, bytes);
    return bytes;
  }

  void _remember(int index, Uint8List bytes) {
    _cache[index] = bytes;
    _cachedBytes += bytes.length;
    while (_cachedBytes > maxCachedBytes && _cache.length > 1) {
      final oldest = _cache.keys.first;
      _cachedBytes -= _cache.remove(oldest)!.length;
    }
  }

  Future<Response<List<int>>> _get(String range) async {
    for (var attempt = 1; ; attempt++) {
      try {
        final response = await dio.get<List<int>>(
          _path,
          cancelToken: _cancel,
          options: Options(
            responseType: ResponseType.bytes,
            headers: {'Range': range},
            validateStatus: (s) => s == 206 || s == 200,
          ),
        );
        return response;
      } on DioException catch (error) {
        final status = error.response?.statusCode;
        final retryable =
            error.type != DioExceptionType.cancel &&
            (status == null || status >= 500);
        if (!retryable || attempt >= maxAttempts) throw _toApi(error);
        await Future<void>.delayed(_backoff(attempt));
      }
    }
  }

  /// HTTP errors carry the server's status and `{error}` body (404 = no
  /// access or no file, 401 = session over); others are transport errors.
  static ApiException _toApi(DioException error) {
    final response = error.response;
    if (response == null) return apiExceptionFromDio(error);
    Object? body;
    try {
      final data = response.data;
      body = data is List<int> ? jsonDecode(utf8.decode(data)) : data;
    } catch (_) {}
    return apiExceptionFromRest(response.statusCode ?? 0, body);
  }

  static int? _totalFromContentRange(String? header) {
    // "bytes 0-0/12345"
    final slash = header?.lastIndexOf('/') ?? -1;
    if (header == null || slash < 0) return null;
    return int.tryParse(header.substring(slash + 1).trim());
  }

  /// Cancels pending requests and drops every cached byte.
  void dispose() {
    _cancel.cancel();
    _cache.clear();
    _cachedBytes = 0;
  }

  /// For the performance check.
  int get cachedBytes => _cachedBytes;
}
