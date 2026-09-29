import 'package:flutter/material.dart';
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
