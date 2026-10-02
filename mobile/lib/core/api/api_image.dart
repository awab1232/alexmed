// ignore_for_file: prefer_initializing_formals — the private fields are set from public named parameters.
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../l10n/app_localizations.dart';
import '../ui/components/nl_states.dart';
import '../ui/theme.dart';
import '../ui/tokens.dart';
import 'api_error.dart';
import 'trpc_client.dart' show apiExceptionFromDio;

/// Images the server addresses by a path on its own origin — question and
/// مِرآة card images (`/api/files/<key>`, which checks access and answers
/// with a redirect to a short-lived signed storage URL) and protected
/// doctor-set images (`/api/question-sets/<set>/images/<id>`, bytes sent
/// directly, `no-store`).
///
/// The session goes only to the API origin. The redirect is read, not
/// followed by the API client, and the signed URL is fetched by a separate
/// client without the cookie — the same rule as uploads and the reader.
/// Bytes live in a bounded in-memory cache (never on disk) that is dropped
/// on sign-out; `cache: false` (protected sets) keeps them out of it too.
class ApiImageLoader {
  ApiImageLoader({required Dio api, Dio? storage, int maxBytes = 24 << 20})
    : _api = api,
      _storage = storage ?? Dio(),
      _maxBytes = maxBytes;

  final Dio _api;
  final Dio _storage;
  final int _maxBytes;

  final _cache = <String, Uint8List>{}; // insertion-ordered (LRU)
  final _inFlight = <String, Future<Uint8List>>{};
  int _bytes = 0;

  int get cachedBytes => _bytes;

  /// Only paths on the API origin are accepted — a question image never
  /// comes from anywhere else, and the session must not leave the origin.
  static bool isApiPath(String url) =>
      url.startsWith('/api/') && !url.startsWith('//');

  Future<Uint8List> load(String url, {bool cache = true}) {
    if (!isApiPath(url)) return Future.error(const NotFoundException());
    final hit = _cache.remove(url);
    if (hit != null) {
      _cache[url] = hit; // most recently used last
      return Future.value(hit);
    }
    return _inFlight[url] ??= _fetch(url)
        .then((bytes) {
          if (cache) _remember(url, bytes);
          return bytes;
        })
        .whenComplete(() {
          // A block body: returning the removed future would make this
          // future wait on itself forever.
          _inFlight.remove(url);
        });
  }

  Future<Uint8List> _fetch(String url) async {
    final Response<List<int>> first;
    try {
      first = await _api.get<List<int>>(
        url,
        options: Options(
          responseType: ResponseType.bytes,
          followRedirects: false,
          validateStatus: (_) => true,
        ),
      );
    } on DioException catch (error) {
      throw apiExceptionFromDio(error);
    }
    final status = first.statusCode ?? 0;
    if (status >= 200 && status < 300 && first.data != null) {
      return Uint8List.fromList(first.data!);
    }
    if (status >= 300 && status < 400) {
      final location = first.headers.value('location');
      final target = location == null ? null : Uri.tryParse(location);
      if (target == null || !target.isAbsolute || target.scheme != 'https') {
        throw const ServerException();
      }
      try {
        final signed = await _storage.get<List<int>>(
          target.toString(),
          options: Options(responseType: ResponseType.bytes),
        );
        if (signed.data == null) throw const ServerException();
        return Uint8List.fromList(signed.data!);
      } on DioException catch (error) {
        throw apiExceptionFromDio(error);
      }
    }
    if (status == 401) throw const UnauthorizedException();
    if (status == 403 || status == 404) throw const NotFoundException();
    throw const ServerException();
  }

  void _remember(String url, Uint8List bytes) {
    if (bytes.length > _maxBytes ~/ 4) return; // one image never owns it
    _cache[url] = bytes;
    _bytes += bytes.length;
    while (_bytes > _maxBytes && _cache.isNotEmpty) {
      final oldest = _cache.keys.first;
      _bytes -= _cache.remove(oldest)!.length;
    }
  }

  void clear() {
    _cache.clear();
    _bytes = 0;
  }
}

final apiImageLoaderProvider = Provider<ApiImageLoader>((ref) {
  final loader = ApiImageLoader(api: ref.watch(dioProvider));
  ref
      .read(sessionControllerProvider.notifier)
      .addSignOutHook(() async => loader.clear());
  return loader;
});

/// An image from the API origin, zoomable, with a failure placeholder
/// (blueprint §11). A null or foreign URL shows nothing.
class ApiImage extends ConsumerStatefulWidget {
  const ApiImage({
    super.key,
    required this.url,
    this.cache = true,
    this.zoomable = true,
    this.height = 180,
  });

  final String url;

  /// false for protected content — kept only while this widget shows it.
  final bool cache;
  final bool zoomable;

  /// Placeholder height while loading / on failure.
  final double height;

  @override
  ConsumerState<ApiImage> createState() => _ApiImageState();
}

class _ApiImageState extends ConsumerState<ApiImage> {
  late Future<Uint8List> _bytes = _load();

  Future<Uint8List> _load() =>
      ref.read(apiImageLoaderProvider).load(widget.url, cache: widget.cache);

  @override
  void didUpdateWidget(covariant ApiImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) _bytes = _load();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(NlRadius.md),
      child: FutureBuilder<Uint8List>(
        future: _bytes,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return _Failed(
              height: widget.height,
              onRetry: () => setState(() => _bytes = _load()),
            );
          }
          final bytes = snapshot.data;
          if (bytes == null) {
            return NlSkeleton(height: widget.height);
          }
          final image = Image.memory(
            bytes,
            fit: BoxFit.contain,
            gaplessPlayback: true,
            errorBuilder: (context, _, _) =>
                _Failed(height: widget.height, onRetry: null),
          );
          return widget.zoomable
              ? GestureDetector(
                  onTap: () => _openFullScreen(context, bytes),
                  child: image,
                )
              : image;
        },
      ),
    );
  }

  void _openFullScreen(BuildContext context, Uint8List bytes) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (context) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            foregroundColor: Colors.white,
          ),
          body: InteractiveViewer(
            maxScale: 5,
            child: Center(child: Image.memory(bytes, fit: BoxFit.contain)),
          ),
        ),
      ),
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.height, required this.onRetry});

  final double height;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Material(
      color: NlColors.paper,
      child: InkWell(
        onTap: onRetry,
        child: SizedBox(
          height: height / 2,
          child: Center(
            child: Text(
              onRetry == null
                  ? l10n.cardImageFailed
                  : '${l10n.cardImageFailed} · ${l10n.actionRetry}',
              style: NlText.caption,
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}
