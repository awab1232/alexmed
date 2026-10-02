import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/providers.dart';
import '../../../app/routes.dart';
import '../../../core/phone.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/account_repository.dart';
import 'account_sheets.dart';

/// حسابي — grouped like the web's /account (2026-09-29 layout): الحساب ·
/// دراستي · الإدارة (approved doctors only) · المساعدة · sign out. Admin
/// tools stay on the web. No purchase anywhere (plan is read-only).
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  Future<void> _openWebPage(
    BuildContext context,
    WidgetRef ref,
    String path,
  ) async {
    final base = ref.read(envProvider).apiBaseUrl;
    final ok = await launchUrl(
      Uri.parse('$base$path'),
      mode: LaunchMode.inAppBrowserView,
    );
    if (!ok && context.mounted) {
      showNlToast(context, AppLocalizations.of(context).openInBrowserFailed);
    }
  }

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showNlConfirm(
      context,
      title: l10n.signOutConfirmTitle,
      message: l10n.signOutConfirmBody,
      confirmLabel: l10n.signOut,
    );
    if (confirmed) {
      await ref.read(sessionControllerProvider.notifier).signOut();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final profile = ref.watch(profileProvider);
    final plan = ref.watch(planProvider).value;
    final username = ref.watch(usernameProvider).value;
    final doctor = ref.watch(doctorStatusProvider).value;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.tabAccount)),
      body: profile.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(NlSpace.page),
          child: NlListSkeleton(rows: 6),
        ),
        error: (error, _) => NlErrorView(
          error: error,
          onRetry: () => ref.invalidate(profileProvider),
        ),
        data: (me) => RefreshIndicator(
          color: NlColors.ink,
          onRefresh: () async {
            ref
              ..invalidate(profileProvider)
              ..invalidate(planProvider)
              ..invalidate(usernameProvider)
              ..invalidate(doctorStatusProvider);
            await ref.read(profileProvider.future).catchError((_) => me);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              NlSpace.page,
              NlSpace.sm,
              NlSpace.page,
              NlSpace.xxxl,
            ),
            children: [
              _Identity(profile: me, planName: plan?.planName),
              const SizedBox(height: 22),
              NlGroup(
                title: l10n.accountGroup,
                children: [
                  NlRow(
                    icon: LucideIcons.userRound,
                    label: l10n.studyProfile,
                    value: me.studyLine.isEmpty
                        ? l10n.studyProfileEmpty
                        : me.studyLine,
                    onTap: () => showStudyProfileSheet(context, me),
                  ),
                  NlRow(
                    icon: LucideIcons.atSign,
                    label: l10n.usernameRow,
                    value: username == null
                        ? l10n.usernameEmpty
                        : isolateLtr('@$username'),
                    onTap: () => context.push(Routes.shared),
                  ),
                  NlRow(
                    icon: LucideIcons.creditCard,
                    label: l10n.planRow,
                    value: plan?.planName,
                    onTap: () => context.push(Routes.plan),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              NlGroup(
                title: l10n.studyGroup,
                children: [
                  NlRow(
                    icon: LucideIcons.bookOpen,
                    label: l10n.questionFilesRow,
                    onTap: () => context.push(Routes.questionFiles),
                  ),
                  NlRow(
                    icon: LucideIcons.clipboardList,
                    label: l10n.qfTitle,
                    onTap: () => context.push(Routes.questionBanks),
                  ),
                  NlRow(
                    icon: LucideIcons.chartColumn,
                    label: l10n.statsRow,
                    onTap: () => context.push(Routes.stats),
                  ),
                  NlRow(
                    icon: LucideIcons.users,
                    label: l10n.sharedWithMe,
                    onTap: () => context.push(Routes.shared),
                  ),
                  NlRow(
                    icon: LucideIcons.shieldBan,
                    label: l10n.shBlockedTitle,
                    onTap: () => context.push(Routes.blocked),
                  ),
                ],
              ),
              if (doctor?.approved ?? false) ...[
                const SizedBox(height: 22),
                NlGroup(
                  title: l10n.adminGroup,
                  children: [
                    NlRow(
                      icon: LucideIcons.stethoscope,
                      label: l10n.doctorDashboard,
                      onTap: () => context.push(Routes.doctor),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 22),
              NlGroup(
                title: l10n.helpGroup,
                children: [
                  NlRow(
                    icon: LucideIcons.shieldCheck,
                    label: l10n.privacyPolicy,
                    onTap: () => _openWebPage(context, ref, '/privacy'),
                  ),
                  NlRow(
                    icon: LucideIcons.fileText,
                    label: l10n.termsOfUse,
                    onTap: () => _openWebPage(context, ref, '/terms'),
                  ),
                  NlRow(
                    icon: LucideIcons.lifeBuoy,
                    label: l10n.contactUs,
                    onTap: () => _openWebPage(context, ref, '/contact'),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              NlGroup(
                children: [
                  NlRow(
                    icon: LucideIcons.logOut,
                    label: l10n.signOut,
                    showChevron: false,
                    onTap: () => _signOut(context, ref),
                  ),
                ],
              ),
              if (doctor != null && !doctor.approved) ...[
                const SizedBox(height: NlSpace.md),
                Center(
                  child: NlButton(
                    label: switch (doctor.applicationStatus) {
                      'pending' => l10n.doctorPending,
                      'rejected' => l10n.doctorRejected,
                      'suspended' => l10n.doctorSuspended,
                      _ => l10n.doctorApply,
                    },
                    kind: NlButtonKind.ghost,
                    onPressed: () => context.push(Routes.doctorApply),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Who you are: initial, name, contact (LTR), plan + study badges.
class _Identity extends StatelessWidget {
  const _Identity({required this.profile, this.planName});

  final AccountProfile profile;
  final String? planName;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final name = profile.name?.trim().isNotEmpty ?? false
        ? profile.name!.trim()
        : (profile.email ?? l10n.tabAccount);
    final contact =
        profile.email ??
        (profile.phone != null ? formatPhoneForDisplay(profile.phone!) : null);
    return Container(
      padding: const EdgeInsets.all(NlSpace.xl),
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.lg),
        border: Border.all(color: NlColors.rule),
      ),
      child: Row(
        children: [
          ExcludeSemantics(
            child: CircleAvatar(
              radius: 30,
              backgroundColor: NlColors.ink,
              child: Text(
                name.characters.first.toUpperCase(),
                style: NlText.title.copyWith(color: Colors.white, fontSize: 24),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: NlText.title.copyWith(fontSize: 22)),
                if (contact != null)
                  Text(isolateLtr(contact), style: NlText.caption),
                const SizedBox(height: NlSpace.sm),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (planName != null) NlBadge(planName!, marked: true),
                    if (profile.studyLine.isNotEmpty)
                      NlBadge(profile.studyLine),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
