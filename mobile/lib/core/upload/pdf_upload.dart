import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../api/api_error.dart';
import '../api/rest_client.dart';

/// A PDF the student picked, checked before any upload.
final class PickedPdf {
  const PickedPdf({required this.path, required this.name, required this.size});

  final String path;
  final String name;
  final int size;
}

/// Thrown before uploading when the file is not something the server will
/// accept — with the same Arabic wording as the web.
final class PdfRejected implements Exception {
  const PdfRejected(this.message);
  final String message;
}

/// Opens the file and checks it really is a PDF (`%PDF` header), not just a
/// ".pdf" name, and that it fits the plan's size limit when one is known.
Future<PickedPdf> checkPdf(File file, {int? maxFileSizeMb}) async {
  final name = file.uri.pathSegments.last;
  if (!name.toLowerCase().endsWith('.pdf')) {
    throw const PdfRejected('اختَر ملف PDF فقط.');
  }
  final size = await file.length();
  if (size <= 0) throw const PdfRejected('الملف فارغ.');
  if (maxFileSizeMb != null && size > maxFileSizeMb * 1024 * 1024) {
    throw PdfRejected('حجم الملف أكبر من حد باقتك ($maxFileSizeMb MB).');
  }
  final raf = await file.open();
  try {
    final head = await raf.read(5);
    if (String.fromCharCodes(head) != '%PDF-') {
      throw const PdfRejected('هذا الملف ليس PDF صالحًا.');
    }
  } finally {
    await raf.close();
  }
  return PickedPdf(path: file.path, name: name, size: size);
}

/// Uploads a PDF the way the web does (blueprint §10): ask the server for a
/// presigned R2 URL, then PUT the bytes straight to storage — streamed from
/// disk, never loaded into memory. Network drops are retried with backoff;
/// an expired URL (15 min) is replaced by a fresh one. The session never
/// goes to storage, and the presigned URL is never stored or logged.
class PdfUploader {
  PdfUploader({required RestClient api, Dio? storage})
    // ignore: prefer_initializing_formals
    : _api = api,
      _storage =
          storage ??
          Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 20),
              sendTimeout: const Duration(minutes: 10),
              receiveTimeout: const Duration(seconds: 60),
              validateStatus: (_) => true,
            ),
          );

  final RestClient _api;
  final Dio _storage;

  static const maxAttempts = 3;

  /// Returns the storage key the pipeline endpoints expect.
  Future<String> upload(
    PickedPdf pdf, {
    required String uploadUrlPath,
    void Function(double progress)? onProgress,
    CancelToken? cancelToken,
    Duration Function(int attempt)? backoff,
  }) async {
    Future<({String key, String url})> freshUrl() async {
      final data = await _api.postJson(uploadUrlPath, {
        'fileName': pdf.name,
        'fileSize': pdf.size,
        'contentType': 'application/pdf',
      }, cancelToken: cancelToken);
      final key = data['key'];
      final url = data['uploadUrl'];
      if (key is! String || url is! String) throw const ServerException();
      return (key: key, url: url);
    }

    var target = await freshUrl();
    for (var attempt = 1; ; attempt++) {
      onProgress?.call(0);
      final Response<Object?> response;
      try {
        response = await _storage.put<Object?>(
          target.url,
          data: File(pdf.path).openRead(),
          options: Options(
            headers: {
              Headers.contentTypeHeader: 'application/pdf',
              Headers.contentLengthHeader: pdf.size,
            },
          ),
          cancelToken: cancelToken,
          onSendProgress: (sent, total) {
            if (total > 0) onProgress?.call(sent / total);
          },
        );
      } on DioException catch (error) {
        if (error.type == DioExceptionType.cancel) rethrow;
        if (attempt >= maxAttempts) throw const NetworkException();
        await Future<void>.delayed(
          backoff?.call(attempt) ?? Duration(seconds: 2 * attempt),
        );
        continue;
      }
      final status = response.statusCode ?? 0;
      if (status >= 200 && status < 300) {
        onProgress?.call(1);
        return target.key;
      }
      if (attempt >= maxAttempts) {
        throw const ServerException(
          'تعذر رفع الملف للتخزين. تحقق من الاتصال وحاول مرة أخرى.',
        );
      }
      // 403 = the signed URL expired (slow network) — sign a new one.
      if (status == 403) target = await freshUrl();
      await Future<void>.delayed(
        backoff?.call(attempt) ?? Duration(seconds: 2 * attempt),
      );
    }
  }
}

/// Opens the system document picker for one PDF; null = cancelled. A
/// provider so tests can hand in a local file.
typedef PdfPathPicker = Future<String?> Function();

final pdfPathPickerProvider = Provider<PdfPathPicker>(
  (ref) => () async {
    final files = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf'],
    );
    return files.isEmpty ? null : files.single.path;
  },
);

final restClientProvider = Provider<RestClient>(
  (ref) => RestClient(ref.watch(dioProvider)),
);

final pdfUploaderProvider = Provider<PdfUploader>(
  (ref) => PdfUploader(api: ref.watch(restClientProvider)),
);
