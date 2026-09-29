import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../core/auth/session_controller.dart';
import '../../../core/phone.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/auth_repository.dart';
import 'auth_widgets.dart';

enum _Step { phone, code, details }

/// Phone sign-up, the web's RegisterForm flow: number → SMS code → name and
/// password → account created → signed in. The server owns every rule
/// (SMS limits, code checks, taken numbers); the form only pre-checks the
/// number format with the same parser the server uses.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _password = TextEditingController();

  _Step _step = _Step.phone;
  String _country = defaultPhoneCountry;
  PhoneVerificationStarted? _verification;
  int _resendIn = 0;
  Timer? _resendTimer;
  bool _busy = false;
  String? _error;

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  void dispose() {
    _resendTimer?.cancel();
    _phone.dispose();
    _code.dispose();
    _name.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorText(context, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _startResendCountdown(Duration wait) {
    _resendTimer?.cancel();
    setState(() => _resendIn = wait.inSeconds);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _resendIn <= 1) {
        timer.cancel();
        if (mounted) setState(() => _resendIn = 0);
        return;
      }
      setState(() => _resendIn--);
    });
  }

  Future<void> _sendCode() async {
    final l10n = AppLocalizations.of(context);
    if (parsePhone(_phone.text, _country) == null) {
      setState(() => _error = l10n.registerInvalidPhone);
      return;
    }
    await _run(() async {
      final started = await _repo.startPhoneVerification(
        phone: _phone.text,
        country: _country,
      );
      _verification = started;
      _code.clear();
      _startResendCountdown(started.resendAfter);
      setState(() => _step = _Step.code);
    });
  }

  Future<void> _verifyCode() async {
    final verification = _verification;
    if (verification == null) return;
    await _run(() async {
      await _repo.checkPhoneCode(
        verificationId: verification.verificationId,
        code: toAsciiDigits(_code.text.trim()),
      );
      setState(() => _step = _Step.details);
    });
  }

  Future<void> _createAccount() async {
    final verification = _verification;
    if (verification == null) return;
    final l10n = AppLocalizations.of(context);
    if (_name.text.trim().length < 2) {
      setState(() => _error = l10n.registerNameError);
      return;
    }
    if (_password.text.length < 8) {
      setState(() => _error = l10n.registerPasswordError);
      return;
    }
    await _run(() async {
      await _repo.register(
        verificationId: verification.verificationId,
        name: _name.text,
        password: _password.text,
      );
      // Same as the web: sign in with the new number + password.
      final result = await _repo.login(
        identifier: verification.phone,
        password: _password.text,
      );
      await ref.read(sessionControllerProvider.notifier).signIn(result.session);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.registerTitle)),
      body: SafeArea(
        child: AutofillGroup(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              NlSpace.xxl,
              NlSpace.sm,
              NlSpace.xxl,
              NlSpace.xxl,
            ),
            children: [
              NlProgressBar(value: (_step.index + 1) / _Step.values.length),
              const SizedBox(height: NlSpace.xxl),
              ...switch (_step) {
                _Step.phone => _phoneStep(l10n),
                _Step.code => _codeStep(l10n),
                _Step.details => _detailsStep(l10n),
              },
              if (_error != null) ...[
                const SizedBox(height: NlSpace.md),
                AuthError(_error!),
              ],
              const SizedBox(height: NlSpace.xl),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(l10n.registerHaveAccount, style: NlText.secondary),
                  NlButton(
                    label: l10n.welcomeSignIn,
                    kind: NlButtonKind.ghost,
                    onPressed: () => context.pushReplacement(Routes.login),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _phoneStep(AppLocalizations l10n) {
    final country = findCountry(_country) ?? phoneCountries.first;
    return [
      Text(l10n.registerPhoneStep, style: NlText.title),
      const SizedBox(height: NlSpace.xs),
      Text(l10n.registerPhoneHint, style: NlText.secondary),
      const SizedBox(height: NlSpace.xl),
      Text(
        l10n.registerCountry,
        style: NlText.label.copyWith(color: NlColors.ink),
      ),
      const SizedBox(height: 6),
      DropdownButtonFormField<String>(
        initialValue: _country,
        isExpanded: true,
        items: [
          for (final c in phoneCountries)
            DropdownMenuItem(
              value: c.iso,
              child: Text(
                '${c.flag}  ${c.nameAr}  ${isolateLtr('+${c.dial}')}',
              ),
            ),
        ],
        onChanged: _busy ? null : (iso) => setState(() => _country = iso!),
      ),
      const SizedBox(height: NlSpace.lg),
      AuthField(
        label: l10n.registerPhone,
        controller: _phone,
        ltr: true,
        hint: country.example,
        keyboardType: TextInputType.phone,
        autofillHints: const [AutofillHints.telephoneNumberNational],
        textInputAction: TextInputAction.done,
        onSubmitted: (_) => _sendCode(),
      ),
      const SizedBox(height: NlSpace.xl),
      NlButton(
        label: l10n.registerSendCode,
        loading: _busy,
        expand: true,
        onPressed: _sendCode,
      ),
    ];
  }

  List<Widget> _codeStep(AppLocalizations l10n) {
    final phone = formatPhoneForDisplay(_verification?.phone ?? '');
    return [
      Text(l10n.registerCodeStep, style: NlText.title),
      const SizedBox(height: NlSpace.xs),
      Text(l10n.registerCodeSentTo(isolateLtr(phone)), style: NlText.secondary),
      const SizedBox(height: NlSpace.xl),
      AuthField(
        label: l10n.registerCode,
        controller: _code,
        ltr: true,
        maxLength: 6,
        keyboardType: TextInputType.number,
        autofillHints: const [AutofillHints.oneTimeCode],
        textInputAction: TextInputAction.done,
        onSubmitted: (_) => _verifyCode(),
      ),
      const SizedBox(height: NlSpace.xl),
      NlButton(
        label: l10n.registerVerify,
        loading: _busy,
        expand: true,
        onPressed: _verifyCode,
      ),
      const SizedBox(height: NlSpace.md),
      Wrap(
        alignment: WrapAlignment.spaceBetween,
        children: [
          NlButton(
            label: _resendIn > 0
                ? l10n.registerResendIn(_resendIn)
                : l10n.registerResend,
            kind: NlButtonKind.ghost,
            onPressed: _resendIn > 0 || _busy ? null : _sendCode,
          ),
          NlButton(
            label: l10n.registerChangePhone,
            kind: NlButtonKind.ghost,
            onPressed: _busy
                ? null
                : () => setState(() {
                    _step = _Step.phone;
                    _error = null;
                  }),
          ),
        ],
      ),
    ];
  }

  List<Widget> _detailsStep(AppLocalizations l10n) {
    return [
      Text(l10n.registerDetailsStep, style: NlText.title),
      const SizedBox(height: NlSpace.xl),
      AuthField(
        label: l10n.registerName,
        controller: _name,
        maxLength: 100,
        keyboardType: TextInputType.name,
        autofillHints: const [AutofillHints.name],
        textInputAction: TextInputAction.next,
      ),
      const SizedBox(height: NlSpace.lg),
      PasswordField(
        label: l10n.loginPassword,
        controller: _password,
        newPassword: true,
        onSubmitted: (_) => _createAccount(),
      ),
      const SizedBox(height: NlSpace.sm),
      Text(l10n.registerTerms, style: NlText.caption),
      const SizedBox(height: NlSpace.xl),
      NlButton(
        label: l10n.registerSubmit,
        loading: _busy,
        expand: true,
        onPressed: _createAccount,
      ),
    ];
  }
}
