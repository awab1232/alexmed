import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

/// A photo ready to send: JPEG ≤ 1600 px on its long side (the web's
/// MAX_IMAGE_SIDE, quality 0.85) and a 320 px thumbnail (quality 0.7) kept
/// with the saved conversation.
final class PreparedPhoto {
  const PreparedPhoto({required this.jpeg, required this.thumb});

  final Uint8List jpeg;
  final Uint8List thumb;
}

enum PhotoSource { camera, gallery }

/// Why a photo could not be taken.
enum PhotoFailure {
  /// Camera / photos access denied — the student can allow it in Settings
  /// or pick from the gallery instead.
  denied,

  /// Not an image we could read (corrupt, unsupported).
  unreadable,
}

class PhotoException implements Exception {
  const PhotoException(this.failure);
  final PhotoFailure failure;
}

/// Picks a photo (camera, or the system photo picker — Android Photo
/// Picker / iOS PHPicker, no media permission) and prepares it on the
/// device: HEIC → JPEG, EXIF orientation applied and EXIF dropped (no
/// location leaves the phone), downsized. Null when the student cancels.
typedef PhotoPicker = Future<PreparedPhoto?> Function(PhotoSource source);

const maxImageSide = 1600;
const thumbSide = 320;

Future<PreparedPhoto?> pickAndPreparePhoto(PhotoSource source) async {
  final XFile? file;
  try {
    file = await ImagePicker().pickImage(
      source: source == PhotoSource.camera
          ? ImageSource.camera
          : ImageSource.gallery,
      // A first pass on the platform side keeps huge camera photos out of
      // memory; the compressor below makes the final JPEG.
      maxWidth: maxImageSide.toDouble(),
      maxHeight: maxImageSide.toDouble(),
      requestFullMetadata: false,
    );
  } on PlatformException catch (error) {
    if (error.code.contains('access_denied')) {
      throw const PhotoException(PhotoFailure.denied);
    }
    throw const PhotoException(PhotoFailure.unreadable);
  }
  if (file == null) return null;
  try {
    return await preparePhotoBytes(await file.readAsBytes());
  } catch (_) {
    throw const PhotoException(PhotoFailure.unreadable);
  }
}

Future<PreparedPhoto> preparePhotoBytes(Uint8List bytes) async {
  // The compressor scales down (never up) until BOTH sides are at least
  // minWidth / minHeight — i.e. it fits the SHORT side, so 4000×3000 with
  // 1600×1600 came out 2133×1600 (caught on the device). The web limits the
  // LONG side, so: a first pass gives a decodable JPEG with the photo's
  // aspect ratio (after EXIF rotation), then the original is compressed
  // with equal bounds of long-side × short/long, which lands the long side
  // on the limit whatever the orientation.
  Future<Uint8List> jpegAt(Uint8List source, int side, int quality) =>
      FlutterImageCompress.compressWithList(
        source,
        minWidth: side,
        minHeight: side,
        quality: quality,
        format: CompressFormat.jpeg,
        autoCorrectionAngle: true,
        keepExif: false,
      );

  final probe = await jpegAt(bytes, maxImageSide, 85);
  final ratio = await _shortOverLong(probe);
  final jpeg = ratio >= 1
      ? probe
      : await jpegAt(bytes, (maxImageSide * ratio).floor(), 85);
  final thumb = await jpegAt(jpeg, (thumbSide * ratio).floor(), 70);
  if (jpeg.isEmpty || thumb.isEmpty) {
    throw const PhotoException(PhotoFailure.unreadable);
  }
  return PreparedPhoto(jpeg: jpeg, thumb: thumb);
}

final photoPickerProvider = Provider<PhotoPicker>((ref) => pickAndPreparePhoto);

/// Short side / long side of an encoded image, read from its header only.
Future<double> _shortOverLong(Uint8List encoded) async {
  final buffer = await ui.ImmutableBuffer.fromUint8List(encoded);
  final descriptor = await ui.ImageDescriptor.encoded(buffer);
  final w = descriptor.width;
  final h = descriptor.height;
  descriptor.dispose();
  buffer.dispose();
  if (w <= 0 || h <= 0) return 1;
  return (w < h ? w : h) / (w > h ? w : h);
}
