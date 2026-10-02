import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/json.dart';
import '../../../core/api/trpc_client.dart';

/// auth.profile — the account's own row.
final class AccountProfile {
  const AccountProfile({
    required this.id,
    this.name,
    this.email,
    this.phone,
    this.academicYear,
    this.specialty,
  });

  factory AccountProfile.fromJson(JsonMap json) => AccountProfile(
    id: json.str('id'),
    name: json.strOrNull('name'),
    email: json.strOrNull('email'),
    phone: json.strOrNull('phone'),
    academicYear: json.strOrNull('academicYear'),
    specialty: json.strOrNull('specialty'),
  );

  final String id;
  final String? name;
  final String? email;
  final String? phone;
  final String? academicYear;
  final String? specialty;

  /// "طب بشري، السنة الثالثة" (web: specialty then year).
  String get studyLine => [
    specialty,
    academicYear,
  ].whereType<String>().where((s) => s.trim().isNotEmpty).join('، ');
}

/// One usage counter from billing.mine (`{used, limit, remaining}`);
/// `limit == null` means unlimited.
final class UsageMeter {
  const UsageMeter({required this.used, this.limit});

  factory UsageMeter.fromJson(Object? value) {
    if (value is! Map) return const UsageMeter(used: 0);
    final json = asMap(value);
    return UsageMeter(
      used: json.integer('used'),
      limit: json.intOrNull('limit'),
    );
  }

  final int used;
  final int? limit;

  double? get fraction =>
      limit == null || limit == 0 ? null : (used / limit!).clamp(0.0, 1.0);
}

/// billing.mine, read-only: the app shows the plan and today's usage but
/// never a purchase (no payments in this phase; App Store 3.1.1).
final class PlanSummary {
  const PlanSummary({
    required this.planId,
    required this.planName,
    required this.subscribed,
    required this.assistant,
    required this.questionFiles,
    required this.studyFiles,
    this.endsAt,
    this.maxFileSizeMb,
  });

  factory PlanSummary.fromJson(JsonMap json) {
    final plan = asMap(json['plan']);
    final subscription = json['subscription'] is Map
        ? asMap(json['subscription'])
        : null;
    Object? daily(String key) =>
        json[key] is Map ? asMap(json[key])['daily'] : null;
    return PlanSummary(
      planId: plan.str('id'),
      planName: plan.strOrNull('name') ?? plan.str('id'),
      subscribed: subscription != null,
      endsAt: subscription?.date('endDate'),
      assistant: UsageMeter.fromJson(json['assistant']),
      questionFiles: UsageMeter.fromJson(daily('questions')),
      studyFiles: UsageMeter.fromJson(daily('books')),
      maxFileSizeMb: json.intOrNull('maxFileSizeMb'),
    );
  }

  final String planId;
  final String planName;

  /// False = the free plan (the web's `free = !subscription`).
  final bool subscribed;
  final DateTime? endsAt;
  final UsageMeter assistant;
  final UsageMeter questionFiles;
  final UsageMeter studyFiles;
  final int? maxFileSizeMb;
}

/// doctor.status — only asked when protected doctor sets are enabled.
final class DoctorStatus {
  const DoctorStatus({required this.approved, this.applicationStatus});

  factory DoctorStatus.fromJson(JsonMap json) => DoctorStatus(
    approved: json.boolean('approved'),
    applicationStatus: json['profile'] is Map
        ? asMap(json['profile']).strOrNull('status')
        : null,
  );

  final bool approved;

  /// pending / rejected / suspended / approved, or null (never applied).
  final String? applicationStatus;
}

class AccountRepository {
  AccountRepository(this._trpc);

  final TrpcClient _trpc;

  Future<AccountProfile> profile() => _trpc.query(
    'auth.profile',
    offline: true,
    parse: (data) => AccountProfile.fromJson(asMap(data)),
  );

  Future<void> updateProfile({String? academicYear, String? specialty}) =>
      _trpc.mutation(
        'auth.updateProfile',
        input: {'academicYear': academicYear, 'specialty': specialty},
        parse: (_) {},
      );

  Future<PlanSummary> plan() => _trpc.query(
    'billing.mine',
    offline: true,
    parse: (data) => PlanSummary.fromJson(asMap(data)),
  );

  Future<String?> username() => _trpc.query(
    'sharing.profile',
    offline: true,
    parse: (data) => data == null ? null : asMap(data).strOrNull('username'),
  );

  Future<bool> doctorSetsEnabled() => _trpc.query(
    'questionSets.enabled',
    offline: true,
    parse: (data) => data == true,
  );

  Future<DoctorStatus> doctorStatus() => _trpc.query(
    'doctor.status',
    parse: (data) => DoctorStatus.fromJson(asMap(data)),
  );

  /// Permanent — the server deletes the account and all its data. The
  /// word «حذف» is the confirmation the server checks.
  Future<void> deleteAccount() => _trpc.mutation(
    'auth.deleteAccount',
    input: {'confirm': 'حذف'},
    parse: (_) {},
  );
}

final accountRepositoryProvider = Provider<AccountRepository>(
  (ref) => AccountRepository(ref.watch(trpcProvider)),
);

final _accountScope = Provider<Object>(
  (ref) => ref.watch(sessionControllerProvider.select((s) => s.status)),
);

final profileProvider = FutureProvider<AccountProfile>((ref) {
  ref.watch(_accountScope);
  return ref.watch(accountRepositoryProvider).profile();
});

final planProvider = FutureProvider<PlanSummary>((ref) {
  ref.watch(_accountScope);
  return ref.watch(accountRepositoryProvider).plan();
});

final usernameProvider = FutureProvider<String?>((ref) {
  ref.watch(_accountScope);
  return ref.watch(accountRepositoryProvider).username();
});

final doctorSetsEnabledProvider = FutureProvider<bool>((ref) {
  ref.watch(_accountScope);
  return ref.watch(accountRepositoryProvider).doctorSetsEnabled();
});

/// Null while the feature is off (no request is made then).
final doctorStatusProvider = FutureProvider<DoctorStatus?>((ref) async {
  ref.watch(_accountScope);
  final enabled = await ref.watch(doctorSetsEnabledProvider.future);
  if (!enabled) return null;
  return ref.watch(accountRepositoryProvider).doctorStatus();
});
