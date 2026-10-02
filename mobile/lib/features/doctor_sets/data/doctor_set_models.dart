import '../../../core/api/json.dart';
import '../../question_files/data/question_file_models.dart';

// 🔒 Protected Doctor Question Sets — shapes of questionSets.* (student) and
// doctor.* (doctor) as lib/db-question-sets.ts returns them.

/// questionSets.mine row — `availability` decides whether it opens.
enum SetAvailability { available, notStarted, unavailable }

final class StudentSet {
  const StudentSet({
    required this.id,
    required this.title,
    required this.availability,
    this.doctorName,
    this.subjectLabel,
    this.academicYear,
    this.questionCount = 0,
    this.startsAt,
    this.endsAt,
    this.inMyAccount = false,
  });

  factory StudentSet.fromJson(JsonMap json) => StudentSet(
    id: json.str('id'),
    title: json.strOrNull('title') ?? '',
    doctorName: json.strOrNull('doctorName'),
    subjectLabel: json.strOrNull('subjectLabel'),
    academicYear: json.strOrNull('academicYear'),
    questionCount: json.integer('questionCount'),
    startsAt: json.date('startsAt'),
    endsAt: json.date('endsAt'),
    inMyAccount: json.boolean('inMyAccount'),
    availability: switch (json.strOrNull('availability')) {
      'available' => SetAvailability.available,
      'not_started' => SetAvailability.notStarted,
      _ => SetAvailability.unavailable,
    },
  );

  final String id;
  final String title;
  final String? doctorName;
  final String? subjectLabel;
  final String? academicYear;
  final int questionCount;
  final DateTime? startsAt;
  final DateTime? endsAt;

  /// Catalog rows only.
  final bool inMyAccount;
  final SetAvailability availability;
}

/// questionSets.get — the set, its questions (needs-review never included),
/// and the viewer's watermark (null for the owner / an admin).
final class ProtectedSet {
  const ProtectedSet({
    required this.title,
    required this.questions,
    this.doctorName,
    this.subjectLabel,
    this.watermark,
  });

  factory ProtectedSet.fromJson(JsonMap json) {
    final set = json['set'] is Map
        ? asMap(json['set'])
        : const <String, Object?>{};
    return ProtectedSet(
      title: set.strOrNull('title') ?? '',
      doctorName: set.strOrNull('doctorName'),
      subjectLabel: set.strOrNull('subjectLabel'),
      watermark: json.strOrNull('watermark'),
      questions: QuestionContent.fromJson(json).questions,
    );
  }

  final String title;
  final String? doctorName;
  final String? subjectLabel;
  final String? watermark;
  final List<QuestionItem> questions;
}

/// doctor.status.
final class DoctorProfile {
  const DoctorProfile({
    required this.status,
    this.fullName,
    this.university,
    this.faculty,
    this.rejectionReason,
  });

  factory DoctorProfile.fromJson(JsonMap json) => DoctorProfile(
    status: json.strOrNull('status') ?? 'pending',
    fullName: json.strOrNull('fullName'),
    university: json.strOrNull('university'),
    faculty: json.strOrNull('faculty'),
    rejectionReason: json.strOrNull('rejectionReason'),
  );

  /// pending / approved / rejected / suspended.
  final String status;
  final String? fullName;
  final String? university;
  final String? faculty;
  final String? rejectionReason;
}

final class DoctorApplicationState {
  const DoctorApplicationState({required this.approved, this.profile});

  factory DoctorApplicationState.fromJson(JsonMap json) =>
      DoctorApplicationState(
        approved: json.boolean('approved'),
        profile: json['profile'] is Map
            ? DoctorProfile.fromJson(asMap(json['profile']))
            : null,
      );

  final bool approved;
  final DoctorProfile? profile;
}

/// set_status: draft / published / disabled / archived.
enum SetStatus { draft, published, disabled, archived }

SetStatus _setStatus(String? v) => switch (v) {
  'published' => SetStatus.published,
  'disabled' => SetStatus.disabled,
  'archived' => SetStatus.archived,
  _ => SetStatus.draft,
};

/// The editable metadata (doctor.sets.update / create).
final class SetSettings {
  const SetSettings({
    this.title = '',
    this.description = '',
    this.subjectLabel = '',
    this.academicYear = '',
    this.examType = '',
    this.listed = false,
    this.startsAt,
    this.endsAt,
  });

  final String title;
  final String description;
  final String subjectLabel;
  final String academicYear;
  final String examType;
  final bool listed;
  final DateTime? startsAt;
  final DateTime? endsAt;

  SetSettings copyWith({
    String? title,
    String? description,
    String? subjectLabel,
    String? academicYear,
    String? examType,
    bool? listed,
    DateTime? Function()? startsAt,
    DateTime? Function()? endsAt,
  }) => SetSettings(
    title: title ?? this.title,
    description: description ?? this.description,
    subjectLabel: subjectLabel ?? this.subjectLabel,
    academicYear: academicYear ?? this.academicYear,
    examType: examType ?? this.examType,
    listed: listed ?? this.listed,
    startsAt: startsAt == null ? this.startsAt : startsAt(),
    endsAt: endsAt == null ? this.endsAt : endsAt(),
  );

  /// The web's settingsPayload: empty text → null.
  Map<String, Object?> toPayload() {
    String? orNull(String v) => v.trim().isEmpty ? null : v.trim();
    return {
      'title': title.trim(),
      'description': orNull(description),
      'subjectLabel': orNull(subjectLabel),
      'academicYear': orNull(academicYear),
      'examType': orNull(examType),
      'visibility': listed ? 'listed' : 'unlisted',
      'startsAt': startsAt?.toUtc(),
      'endsAt': endsAt?.toUtc(),
    };
  }
}

/// doctor.sets.list / get row.
final class DoctorSet {
  const DoctorSet({
    required this.id,
    required this.title,
    required this.status,
    required this.settings,
    this.bookStatus,
    this.extractionError,
    this.processingDone = false,
    this.windowOpen = true,
    this.questionCount = 0,
    this.extractedQuestions = 0,
    this.needsReviewCount = 0,
    this.codesTotal = 0,
    this.codesClaimed = 0,
    this.activeStudents = 0,
  });

  factory DoctorSet.fromJson(JsonMap json) => DoctorSet(
    id: json.str('id'),
    title: json.strOrNull('title') ?? '',
    status: _setStatus(json.strOrNull('status')),
    bookStatus: json.strOrNull('bookStatus'),
    extractionError: json.strOrNull('extractionError'),
    processingDone: json.boolean('processingDone'),
    windowOpen: json.boolean('windowOpen', fallback: true),
    questionCount: json.integer('questionCount'),
    extractedQuestions: json.integer('extractedQuestions'),
    needsReviewCount: json.integer('needsReviewCount'),
    codesTotal: json.integer('codesTotal'),
    codesClaimed: json.integer('codesClaimed'),
    activeStudents: json.integer('activeStudents'),
    settings: SetSettings(
      title: json.strOrNull('title') ?? '',
      description: json.strOrNull('description') ?? '',
      subjectLabel: json.strOrNull('subjectLabel') ?? '',
      academicYear: json.strOrNull('academicYear') ?? '',
      examType: json.strOrNull('examType') ?? '',
      listed: json.strOrNull('visibility') == 'listed',
      startsAt: json.date('startsAt'),
      endsAt: json.date('endsAt'),
    ),
  );

  final String id;
  final String title;
  final SetStatus status;
  final String? bookStatus;
  final String? extractionError;
  final bool processingDone;
  final bool windowOpen;
  final int questionCount;
  final int extractedQuestions;
  final int needsReviewCount;
  final int codesTotal;
  final int codesClaimed;
  final int activeStudents;
  final SetSettings settings;

  bool get failed => status == SetStatus.draft && bookStatus == 'failed';

  /// The web polls a draft until the pipeline finishes (or fails).
  bool get processing =>
      status == SetStatus.draft && !processingDone && !failed;
}

enum StatusTone { live, warn, stop, muted }

/// The web's setStatusLabel (components/doctor-sets/labels.ts): one label
/// per set, in the order a doctor cares about.
({String label, StatusTone tone}) setStatusLabel(
  DoctorSet set, {
  DateTime? now,
}) {
  switch (set.status) {
    case SetStatus.archived:
      return (label: 'مؤرشفة', tone: StatusTone.muted);
    case SetStatus.disabled:
      return (label: 'معطّلة', tone: StatusTone.stop);
    case SetStatus.draft:
      if (set.bookStatus == 'failed') {
        return (label: 'فشلت المعالجة', tone: StatusTone.stop);
      }
      if (!set.processingDone) {
        return (label: 'جاري المعالجة', tone: StatusTone.warn);
      }
      return (label: 'جاهزة للنشر', tone: StatusTone.warn);
    case SetStatus.published:
      if (!set.windowOpen) {
        final ends = set.settings.endsAt;
        final ended = ends != null && !ends.isAfter(now ?? DateTime.now());
        return ended
            ? (label: 'منتهية', tone: StatusTone.muted)
            : (label: 'لم تبدأ بعد', tone: StatusTone.warn);
      }
      return (label: 'منشورة', tone: StatusTone.live);
  }
}

final class AuditEvent {
  const AuditEvent({
    required this.id,
    required this.event,
    this.count,
    this.setTitle,
    this.actorName,
    this.actorUsername,
    this.createdAt,
  });

  factory AuditEvent.fromJson(JsonMap json) {
    final meta = json['meta'] is Map ? asMap(json['meta']) : null;
    return AuditEvent(
      id: json.str('id'),
      event: json.strOrNull('event') ?? '',
      count: meta?['count'] is num ? (meta!['count']! as num).toInt() : null,
      setTitle: json.strOrNull('setTitle'),
      actorName: json.strOrNull('actorName'),
      actorUsername: json.strOrNull('actorUsername'),
      createdAt: json.date('createdAt'),
    );
  }

  final String id;
  final String event;
  final int? count;
  final String? setTitle;
  final String? actorName;
  final String? actorUsername;
  final DateTime? createdAt;
}

/// The web's AUDIT_EVENT_LABELS.
const auditEventLabels = {
  'created': 'إنشاء المجموعة',
  'settings_updated': 'تعديل الإعدادات',
  'published': 'نشر',
  'disabled': 'تعطيل',
  'enabled': 'إعادة تفعيل',
  'archived': 'أرشفة',
  'codes_generated': 'توليد أكواد',
  'code_revoked': 'إلغاء كود',
  'code_claimed': 'تفعيل كود من طالب',
  'student_revoked': 'سحب وصول طالب',
  'admin_disabled': 'تعطيل من الإدارة',
  'admin_enabled': 'تفعيل من الإدارة',
  'admin_archived': 'أرشفة من الإدارة',
  'admin_viewed': 'اطلاع الإدارة',
  'access_denied_rate_limit': 'حظر مؤقت بسبب محاولات كثيرة',
};

String auditLabel(AuditEvent e) =>
    '${auditEventLabels[e.event] ?? e.event}${e.count == null ? '' : ' (${e.count})'}';

/// The web's REVIEW_REASON_LABELS (needs-review reasons, doctor only).
const reviewReasonLabels = {
  'empty_or_fragment_stem': 'نص السؤال فارغ أو مجرد جزء',
  'incomplete_stem': 'نص السؤال مقطوع قبل نهايته',
  'answer_inside_stem': 'الإجابة مكتوبة داخل نص السؤال',
  'single_option': 'خيار واحد فقط',
  'too_many_options': 'خيارات أكثر من المعقول (قد يكون سؤالان مدموجان)',
  'empty_option': 'خيار فارغ',
  'answer_or_explanation_inside_option': 'إجابة أو شرح داخل أحد الخيارات',
  'next_question_inside_option': 'بداية السؤال التالي داخل أحد الخيارات',
  'missing_options': 'لا توجد خيارات لهذا السؤال',
  'options_out_of_order': 'ترتيب الخيارات غير سليم',
};

final class DoctorStats {
  const DoctorStats({
    this.totalSets = 0,
    this.published = 0,
    this.disabled = 0,
    this.codesTotal = 0,
    this.activeStudents = 0,
    this.recent = const [],
  });

  factory DoctorStats.fromJson(JsonMap json) => DoctorStats(
    totalSets: json.integer('totalSets'),
    published: json.integer('published'),
    disabled: json.integer('disabled'),
    codesTotal: json.integer('codesTotal'),
    activeStudents: json.integer('activeStudents'),
    recent: json['recent'] is List
        ? [for (final e in asMapList(json['recent'])) AuditEvent.fromJson(e)]
        : const [],
  );

  final int totalSets;
  final int published;
  final int disabled;
  final int codesTotal;
  final int activeStudents;
  final List<AuditEvent> recent;
}

/// doctor.sets.preview: the questions as students see them, the image
/// checks (`reviewStatus == check_image`) and the needs-review blocks.
final class SetPreview {
  const SetPreview({
    required this.questions,
    required this.checkImage,
    required this.needsReview,
  });

  factory SetPreview.fromJson(JsonMap json) {
    final content = QuestionContent.fromJson(json);
    final checkImage = <String>{};
    if (json['questions'] is List) {
      for (final q in asMapList(json['questions'])) {
        if (q.strOrNull('reviewStatus') == 'check_image') {
          checkImage.add(q.str('id'));
        }
      }
    }
    return SetPreview(
      questions: content.questions,
      checkImage: checkImage,
      needsReview: content.needsReview,
    );
  }

  final List<QuestionItem> questions;
  final Set<String> checkImage;
  final List<NeedsReviewItem> needsReview;
}

enum CodeStatus { unused, claimed, revoked }

final class AccessCode {
  const AccessCode({
    required this.id,
    required this.hint,
    required this.status,
    this.studentName,
    this.studentUsername,
    this.claimedAt,
    this.revokedAt,
    this.createdAt,
  });

  factory AccessCode.fromJson(JsonMap json) => AccessCode(
    id: json.str('id'),
    hint: json.strOrNull('hint') ?? '',
    status: switch (json.strOrNull('status')) {
      'claimed' => CodeStatus.claimed,
      'revoked' => CodeStatus.revoked,
      _ => CodeStatus.unused,
    },
    studentName: json.strOrNull('studentName'),
    studentUsername: json.strOrNull('studentUsername'),
    claimedAt: json.date('claimedAt'),
    revokedAt: json.date('revokedAt'),
    createdAt: json.date('createdAt'),
  );

  final String id;
  final String hint;
  final CodeStatus status;
  final String? studentName;
  final String? studentUsername;
  final DateTime? claimedAt;
  final DateTime? revokedAt;
  final DateTime? createdAt;
}

final class SetStudent {
  const SetStudent({
    required this.entitlementId,
    required this.active,
    this.name,
    this.username,
    this.grantedAt,
    this.codeHint,
  });

  factory SetStudent.fromJson(JsonMap json) => SetStudent(
    entitlementId: json.str('entitlementId'),
    active: json.strOrNull('status') == 'active',
    name: json.strOrNull('name'),
    username: json.strOrNull('username'),
    grantedAt: json.date('grantedAt'),
    codeHint: json.strOrNull('codeHint'),
  );

  final String entitlementId;
  final bool active;
  final String? name;
  final String? username;
  final DateTime? grantedAt;
  final String? codeHint;
}

/// The web's CSV (codes.generate — the plaintext codes exist only in that
/// response): a `code` header and one code per line.
String codesCsv(List<String> codes) => 'code\n${codes.join('\n')}\n';
