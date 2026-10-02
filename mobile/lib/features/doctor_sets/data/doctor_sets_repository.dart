import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/json.dart';
import '../../../core/api/trpc_client.dart';
import '../../../core/upload/pdf_upload.dart';
import 'doctor_set_models.dart';

/// 🔒 Protected Doctor Question Sets on the existing server. Every gate is
/// server-side: the feature flag (`doctorSetsProcedure`), approval
/// (`doctorProcedure`, read from the database per call), ownership inside
/// every query, the redeem rate limit, access windows. The app only shows
/// what the server returns — protected questions are never written to
/// disk (held in the screen's memory; images `no-store`, not cached).
class DoctorSetsRepository {
  DoctorSetsRepository({required this.trpc, required this.uploader});

  final TrpcClient trpc;
  final PdfUploader uploader;

  // ── Student ───────────────────────────────────────────────────────────

  /// (outcome "added" | "already", setId).
  Future<({bool already, String setId})> redeem(String code) => trpc.mutation(
    'questionSets.redeem',
    input: {'code': code.trim()},
    parse: (data) {
      final json = asMap(data);
      return (
        already: json.strOrNull('outcome') == 'already',
        setId: json.str('setId'),
      );
    },
  );

  Future<List<StudentSet>> mine() => trpc.query(
    'questionSets.mine',
    parse: (data) => [for (final s in asMapList(data)) StudentSet.fromJson(s)],
  );

  Future<List<StudentSet>> catalog() => trpc.query(
    'questionSets.catalog',
    parse: (data) => [for (final s in asMapList(data)) StudentSet.fromJson(s)],
  );

  Future<ProtectedSet> open(String setId) => trpc.query(
    'questionSets.get',
    input: {'setId': setId},
    parse: (data) => ProtectedSet.fromJson(asMap(data)),
  );

  // ── Doctor ────────────────────────────────────────────────────────────

  Future<DoctorApplicationState> status() => trpc.query(
    'doctor.status',
    parse: (data) => DoctorApplicationState.fromJson(asMap(data)),
  );

  Future<void> apply({
    required String fullName,
    required String university,
    required String faculty,
    required String department,
    String? universityEmail,
    String? note,
  }) => trpc.mutation(
    'doctor.submitApplication',
    input: {
      'fullName': fullName.trim(),
      'university': university.trim(),
      'faculty': faculty.trim(),
      'department': department.trim(),
      'universityEmail': (universityEmail ?? '').trim().isEmpty
          ? null
          : universityEmail!.trim(),
      'note': (note ?? '').trim().isEmpty ? null : note!.trim(),
    },
    parse: (_) {},
  );

  Future<DoctorStats> stats() => trpc.query(
    'doctor.stats',
    parse: (data) => DoctorStats.fromJson(asMap(data)),
  );

  Future<List<DoctorSet>> sets() => trpc.query(
    'doctor.sets.list',
    parse: (data) => [for (final s in asMapList(data)) DoctorSet.fromJson(s)],
  );

  Future<DoctorSet> set(String setId) => trpc.query(
    'doctor.sets.get',
    input: {'setId': setId},
    parse: (data) => DoctorSet.fromJson(asMap(asMap(data)['set'])),
  );

  Future<SetPreview> preview(String setId) => trpc.query(
    'doctor.sets.preview',
    input: {'setId': setId},
    parse: (data) => SetPreview.fromJson(asMap(data)),
  );

  /// The same upload every question file uses (/api/books/upload-url →
  /// PUT), then doctor.sets.create starts the same pipeline once.
  Future<String> create({
    required PickedPdf pdf,
    required SetSettings settings,
    void Function(double progress)? onProgress,
    CancelToken? cancelToken,
  }) async {
    final key = await uploader.upload(
      pdf,
      uploadUrlPath: '/api/books/upload-url',
      onProgress: onProgress,
      cancelToken: cancelToken,
    );
    return trpc.mutation(
      'doctor.sets.create',
      input: {...settings.toPayload(), 'key': key, 'fileName': pdf.name},
      parse: (data) => asMap(data).str('setId'),
      cancelToken: cancelToken,
    );
  }

  Future<void> _setAction(String action, String setId) => trpc.mutation(
    'doctor.sets.$action',
    input: {'setId': setId},
    parse: (_) {},
  );

  Future<void> retryProcessing(String setId) =>
      _setAction('retryProcessing', setId);
  Future<void> publish(String setId) => _setAction('publish', setId);
  Future<void> disable(String setId) => _setAction('disable', setId);
  Future<void> enable(String setId) => _setAction('enable', setId);
  Future<void> archive(String setId) => _setAction('archive', setId);

  Future<void> update(String setId, SetSettings settings) => trpc.mutation(
    'doctor.sets.update',
    input: {...settings.toPayload(), 'setId': setId},
    parse: (_) {},
  );

  /// The plaintext codes exist only in this response (the server keeps
  /// hashes) — shown once, never stored by the app.
  Future<({String batchId, List<String> codes})> generateCodes(
    String setId,
    int count,
  ) => trpc.mutation(
    'doctor.codes.generate',
    input: {'setId': setId, 'count': count},
    parse: (data) {
      final json = asMap(data);
      return (
        batchId: json.str('batchId'),
        codes: [for (final c in json['codes']! as List) '$c'],
      );
    },
  );

  Future<List<AccessCode>> codes(
    String setId, {
    CodeStatus? status,
    String? search,
  }) => trpc.query(
    'doctor.codes.list',
    input: {
      'setId': setId,
      if (status != null) 'status': status.name,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    },
    parse: (data) => [for (final c in asMapList(data)) AccessCode.fromJson(c)],
  );

  Future<void> revokeCode(String codeId) => trpc.mutation(
    'doctor.codes.revoke',
    input: {'codeId': codeId},
    parse: (_) {},
  );

  Future<List<SetStudent>> students(String setId) => trpc.query(
    'doctor.students.list',
    input: {'setId': setId},
    parse: (data) => [for (final s in asMapList(data)) SetStudent.fromJson(s)],
  );

  Future<void> revokeStudent(String entitlementId) => trpc.mutation(
    'doctor.students.revoke',
    input: {'entitlementId': entitlementId},
    parse: (_) {},
  );

  Future<List<AuditEvent>> audit(String setId) => trpc.query(
    'doctor.audit',
    input: {'setId': setId},
    parse: (data) => [for (final e in asMapList(data)) AuditEvent.fromJson(e)],
  );
}

final doctorSetsRepositoryProvider = Provider<DoctorSetsRepository>(
  (ref) => DoctorSetsRepository(
    trpc: ref.watch(trpcProvider),
    uploader: ref.watch(pdfUploaderProvider),
  ),
);
