import 'dart:convert';
import 'dart:typed_data';

/// One message in the Niro conversation (the web's `Turn`). [image] — the
/// full photo — lives only in memory for follow-ups; [thumb] is kept with
/// the saved conversation so earlier photos still show.
final class NiroTurn {
  const NiroTurn({
    required this.role,
    required this.content,
    this.image,
    this.thumb,
  });

  factory NiroTurn.fromJson(Map<String, Object?> json) => NiroTurn(
    role: json['role'] == 'assistant' ? 'assistant' : 'user',
    content: json['content'] is String ? json['content']! as String : '',
    thumb: json['thumb'] is String
        ? base64Decode(json['thumb']! as String)
        : null,
  );

  final String role;
  final String content;
  final Uint8List? image;
  final Uint8List? thumb;

  bool get isUser => role == 'user';

  NiroTurn withContent(String text) =>
      NiroTurn(role: role, content: text, image: image, thumb: thumb);

  /// Saved form: never the full photo.
  Map<String, Object?> toJson({bool withThumb = true}) => {
    'role': role,
    'content': content,
    if (withThumb && thumb != null) 'thumb': base64Encode(thumb!),
  };
}

/// Sent back as context each turn (the server caps at 16).
const historyTurns = 16;

/// Kept on the device (the web keeps the last 60 in localStorage).
const savedTurns = 60;

String jpegDataUrl(Uint8List jpeg) =>
    'data:image/jpeg;base64,${base64Encode(jpeg)}';

/// The web's send(): text-only history, plus the latest earlier photo still
/// in memory (so "and question 2?" about the same photo works) unless a new
/// photo is attached. A photo-only turn whose image is no longer in memory
/// (restored from storage) still needs non-empty text for the model.
List<Map<String, Object?>> buildHistory(
  List<NiroTurn> turns, {
  required bool newPhoto,
}) {
  final withSomething = turns
      .where((t) => t.content.isNotEmpty || t.image != null || t.thumb != null)
      .toList();
  final recent = withSomething.length > historyTurns
      ? withSomething.sublist(withSomething.length - historyTurns)
      : withSomething;
  var lastImage = -1;
  if (!newPhoto) {
    for (var i = recent.length - 1; i >= 0; i--) {
      if (recent[i].image != null) {
        lastImage = i;
        break;
      }
    }
  }
  final out = <Map<String, Object?>>[];
  for (final (i, turn) in recent.indexed) {
    final withImage = i == lastImage;
    var content = turn.content;
    if (content.isEmpty && turn.thumb != null && !withImage) {
      content = '[أرسلت صورة]';
    }
    if (content.length > 8000) content = content.substring(0, 8000);
    out.add({
      'role': turn.role,
      'content': content,
      if (withImage) 'image': jpegDataUrl(turn.image!),
    });
  }
  return out;
}
