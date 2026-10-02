// Every failure the API layer can report, as one sealed type, so screens
// switch on what happened instead of parsing strings. Messages shown to the
// student are Arabic; `serverMessage` keeps the server's own text (already
// Arabic for most NiroLearn errors) when it is safe to show.

sealed class ApiException implements Exception {
  const ApiException(this.message);

  /// Arabic, safe to show to the student.
  final String message;

  @override
  String toString() => '$runtimeType: $message';
}

/// No connection, DNS failure, timeout before a response.
final class NetworkException extends ApiException {
  const NetworkException()
    : super('تعذّر الاتصال. تحقق من الإنترنت ثم حاول مرة أخرى.');
}

/// 401 — the session is missing, expired, or the account was suspended or
/// deleted (the server re-checks on every request).
final class UnauthorizedException extends ApiException {
  const UnauthorizedException() : super('انتهت الجلسة. سجّل الدخول مرة أخرى.');
}

/// 403 — signed in but not allowed (e.g. a student calling doctor data).
final class ForbiddenException extends ApiException {
  const ForbiddenException([String? serverMessage])
    : super(serverMessage ?? 'غير مسموح لك بالوصول إلى هذا المحتوى.');
}

final class NotFoundException extends ApiException {
  const NotFoundException([String? serverMessage])
    : super(serverMessage ?? 'غير متاح.');
}

/// 429 without billing details — a rate limit (login, code redemption, AI).
final class RateLimitedException extends ApiException {
  const RateLimitedException([String? serverMessage])
    : super(serverMessage ?? 'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.');
}

/// A plan limit (tRPC `data.billing` / REST `{code, details}`). Informational
/// only in this phase — the app never offers a purchase.
final class PlanLimitException extends ApiException {
  const PlanLimitException(super.message, this.details);

  final PlanLimitDetails details;
}

/// A validation or business-rule rejection whose message the server wrote
/// for the student (BAD_REQUEST, CONFLICT, PRECONDITION_FAILED…).
final class RejectedException extends ApiException {
  const RejectedException(super.message, {required this.code});

  /// tRPC error code, e.g. "BAD_REQUEST".
  final String code;
}

/// Anything else (5xx, unparseable response). The server already hides
/// internal details behind a generic message.
final class ServerException extends ApiException {
  const ServerException([String? serverMessage])
    : super(serverMessage ?? 'حدث خطأ في الخادم. حاول مرة أخرى بعد قليل.');
}

/// Mirrors `BillingErrorDetails` in lib/billing/catalog.ts.
final class PlanLimitDetails {
  const PlanLimitDetails({
    required this.code,
    required this.planName,
    this.resource,
    this.feature,
    this.limit,
    this.used,
    this.maxFileSizeMb,
    this.actualFileSizeMb,
  });

  factory PlanLimitDetails.fromJson(Map<String, Object?> json) {
    num? n(String key) => json[key] is num ? json[key] as num : null;
    return PlanLimitDetails(
      code: json['code'] as String? ?? '',
      planName: json['planName'] as String? ?? '',
      resource: json['resource'] as String?,
      feature: json['feature'] as String?,
      limit: n('limit'),
      used: n('used'),
      maxFileSizeMb: n('maxFileSizeMb'),
      actualFileSizeMb: n('actualFileSizeMb'),
    );
  }

  /// PLAN_LIMIT_REACHED, MONTHLY_LIMIT_REACHED, FILE_SIZE_LIMIT,
  /// FEATURE_NOT_AVAILABLE, SUBSCRIPTION_EXPIRED, PAYMENT_REQUEST_PENDING.
  final String code;
  final String planName;
  final String? resource;
  final String? feature;
  final num? limit;
  final num? used;
  final num? maxFileSizeMb;
  final num? actualFileSizeMb;

  /// Same titles as components/billing/UpgradePrompt.tsx.
  String get title => switch (code) {
    'FILE_SIZE_LIMIT' => 'الملف أكبر من حد باقتك',
    'MONTHLY_LIMIT_REACHED' => 'وصلت للحد الشهري',
    'PLAN_LIMIT_REACHED' => 'وصلت للحد اليومي',
    _ => 'غير متاح في باقتك',
  };
}

/// Maps a tRPC error envelope's decoded `json` to an [ApiException].
ApiException apiExceptionFromTrpc(Map<String, Object?> error, int? status) {
  final message = error['message'] as String?;
  final data = error['data'] is Map
      ? (error['data'] as Map).cast<String, Object?>()
      : const <String, Object?>{};
  final code = data['code'] as String? ?? '';
  final httpStatus = data['httpStatus'] as int? ?? status;
  final billing = data['billing'];
  if (billing is Map) {
    return PlanLimitException(
      message ?? 'وصلت إلى حد باقتك.',
      PlanLimitDetails.fromJson(billing.cast<String, Object?>()),
    );
  }
  return switch (code) {
    'UNAUTHORIZED' => const UnauthorizedException(),
    'FORBIDDEN' => ForbiddenException(_readable(message)),
    'NOT_FOUND' => NotFoundException(_readable(message)),
    'TOO_MANY_REQUESTS' => RateLimitedException(_readable(message)),
    'BAD_REQUEST' ||
    'CONFLICT' ||
    'PRECONDITION_FAILED' ||
    'PAYLOAD_TOO_LARGE' ||
    'UNPROCESSABLE_CONTENT' => RejectedException(
      _readable(message) ?? 'تعذّر تنفيذ الطلب.',
      code: code,
    ),
    _ =>
      httpStatus == 401
          ? const UnauthorizedException()
          : ServerException(_readable(message)),
  };
}

/// Maps a REST route's `{error, code, details}` body (NiroLearn's route
/// convention, e.g. /api/books/upload-url) to an [ApiException].
ApiException apiExceptionFromRest(int status, Object? body) {
  final map = body is Map ? body.cast<String, Object?>() : null;
  final message = _readable(map?['error'] as String?);
  final details = map?['details'];
  if (details is Map && map?['code'] != null) {
    return PlanLimitException(
      message ?? 'وصلت إلى حد باقتك.',
      PlanLimitDetails.fromJson(details.cast<String, Object?>()),
    );
  }
  return switch (status) {
    401 => const UnauthorizedException(),
    403 => ForbiddenException(message),
    404 => NotFoundException(message),
    429 => RateLimitedException(message),
    >= 400 && < 500 => RejectedException(
      message ?? 'تعذّر تنفيذ الطلب.',
      code: '$status',
    ),
    _ => ServerException(message),
  };
}

// tRPC's own English input-validation messages ("Expected string, received
// number"…) are developer text, not something to show a student.
String? _readable(String? message) {
  if (message == null || message.trim().isEmpty) return null;
  final hasArabic = RegExp(r'[\u0600-\u06FF]').hasMatch(message);
  return hasArabic ? message : null;
}
