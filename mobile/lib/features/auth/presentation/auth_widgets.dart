import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';

/// Labelled field as on the web auth forms: the label above, the input
/// below. Phone numbers, emails and codes are typed left-to-right.
class AuthField extends StatelessWidget {
  const AuthField({
    super.key,
    required this.label,
    required this.controller,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.ltr = false,
    this.hint,
    this.onSubmitted,
    this.maxLength,
    this.enabled = true,
  });

  final String label;
  final TextEditingController controller;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final bool ltr;
  final String? hint;
  final ValueChanged<String>? onSubmitted;
  final int? maxLength;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: NlText.label.copyWith(color: NlColors.ink)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          enabled: enabled,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          autofillHints: autofillHints,
          textDirection: ltr ? TextDirection.ltr : null,
          textAlign: TextAlign.start,
          maxLength: maxLength,
          onSubmitted: onSubmitted,
          style: NlText.body,
          decoration: InputDecoration(
            hintText: hint,
            // The hint sits where the typing starts (left for numbers /
            // emails), as the web's dir="ltr" inputs do.
            hintTextDirection: ltr ? TextDirection.ltr : null,
            counterText: '',
          ),
        ),
      ],
    );
  }
}

class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.label,
    required this.controller,
    this.onSubmitted,
    this.newPassword = false,
  });

  final String label;
  final TextEditingController controller;
  final ValueChanged<String>? onSubmitted;

  /// Offer the system password generator instead of saved passwords.
  final bool newPassword;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _visible = false;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(widget.label, style: NlText.label.copyWith(color: NlColors.ink)),
        const SizedBox(height: 6),
        TextField(
          controller: widget.controller,
          obscureText: !_visible,
          enableSuggestions: false,
          autocorrect: false,
          textDirection: TextDirection.ltr,
          autofillHints: [
            widget.newPassword
                ? AutofillHints.newPassword
                : AutofillHints.password,
          ],
          textInputAction: TextInputAction.done,
          onSubmitted: widget.onSubmitted,
          style: NlText.body,
          decoration: InputDecoration(
            suffixIcon: IconButton(
              tooltip: _visible ? l10n.hidePassword : l10n.showPassword,
              icon: Icon(
                _visible ? LucideIcons.eyeOff : LucideIcons.eye,
                size: 20,
                color: NlColors.ink3,
              ),
              onPressed: () => setState(() => _visible = !_visible),
            ),
          ),
        ),
      ],
    );
  }
}

/// Inline error under a form (web `.text-destructive`).
class AuthError extends StatelessWidget {
  const AuthError(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Text(
        message,
        style: NlText.body.copyWith(color: NlColors.wrong, fontSize: 14),
      ),
    );
  }
}

/// "أو" between the password form and the Google button (web LoginForm).
class AuthOrDivider extends StatelessWidget {
  const AuthOrDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: NlColors.rule, height: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: NlSpace.md),
          child: Text(
            AppLocalizations.of(context).authOr,
            style: NlText.secondary.copyWith(fontSize: 12),
          ),
        ),
        const Expanded(child: Divider(color: NlColors.rule, height: 1)),
      ],
    );
  }
}

/// Outlined "Sign in with Google" button with the standard multicolour G
/// (components/AuthFields.tsx GoogleIcon).
class GoogleButton extends StatelessWidget {
  const GoogleButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  static const _logo =
      '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">'
      '<path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>'
      '<path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>'
      '<path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>'
      '<path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>'
      '</svg>';

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: OutlinedButton(
        onPressed: loading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: NlColors.sheet,
          foregroundColor: NlColors.ink,
          side: const BorderSide(color: NlColors.ruleStrong),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NlRadius.sm),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            loading
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : SvgPicture.string(_logo, width: 18, height: 18),
            const SizedBox(width: NlSpace.sm),
            Text(
              label,
              style: NlText.body.copyWith(fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }
}
