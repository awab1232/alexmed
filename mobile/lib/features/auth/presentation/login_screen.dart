import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../core/auth/session_controller.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/auth_repository.dart';
import 'auth_widgets.dart';

/// Phone-or-email + password sign-in (the web's LoginForm). On success the
/// session is stored and the router moves to Home by itself.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    final l10n = AppLocalizations.of(context);
    if (_identifier.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = l10n.loginFillBoth);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(authRepositoryProvider)
          .login(identifier: _identifier.text, password: _password.text);
      await ref.read(sessionControllerProvider.notifier).signIn(result.session);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final expired = ref.watch(sessionControllerProvider).expired;
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: AutofillGroup(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              NlSpace.xxl,
              0,
              NlSpace.xxl,
              NlSpace.xxl,
            ),
            children: [
              const Center(
                child: NiroImage(expression: NiroExpression.normal, size: 110),
              ),
              const SizedBox(height: NlSpace.lg),
              Text(l10n.loginTitle, style: NlText.display),
              const SizedBox(height: NlSpace.xs),
              Text(l10n.loginSubtitle, style: NlText.secondary),
              if (expired) ...[
                const SizedBox(height: NlSpace.lg),
                Container(
                  padding: const EdgeInsets.all(NlSpace.md),
                  decoration: BoxDecoration(
                    color: NlColors.markerSoft,
                    borderRadius: BorderRadius.circular(NlRadius.sm),
                  ),
                  child: Text(l10n.sessionEndedNotice, style: NlText.body),
                ),
              ],
              const SizedBox(height: NlSpace.xxl),
              AuthField(
                label: l10n.loginIdentifier,
                controller: _identifier,
                ltr: true,
                hint: '07X XXX XXXX',
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [
                  AutofillHints.username,
                  AutofillHints.telephoneNumber,
                ],
              ),
              const SizedBox(height: NlSpace.lg),
              PasswordField(
                label: l10n.loginPassword,
                controller: _password,
                onSubmitted: (_) => _submit(),
              ),
              if (_error != null) ...[
                const SizedBox(height: NlSpace.md),
                AuthError(_error!),
              ],
              const SizedBox(height: NlSpace.xl),
              NlButton(
                label: _busy ? l10n.loginSubmitting : l10n.loginSubmit,
                loading: _busy,
                expand: true,
                onPressed: _submit,
              ),
              const SizedBox(height: NlSpace.lg),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(l10n.loginNoAccount, style: NlText.secondary),
                  NlButton(
                    label: l10n.loginCreateAccount,
                    kind: NlButtonKind.ghost,
                    onPressed: () => context.pushReplacement(Routes.register),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
