import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';

/// First screen for a signed-out student — Niro, one sentence about what
/// the app does, and the two ways in. No marketing page (blueprint §5).
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: NlSpace.xxl),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: NlSpace.xxxl),
                  const Center(
                    child: NiroImage(
                      expression: NiroExpression.explaining,
                      size: 180,
                    ),
                  ),
                  const SizedBox(height: NlSpace.xxl),
                  Text(
                    l10n.welcomeHeadline,
                    style: NlText.display,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: NlSpace.sm),
                  Text(
                    l10n.welcomeBody,
                    style: NlText.secondary,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: NlSpace.xxxl),
                  NlButton(
                    label: l10n.welcomeSignIn,
                    expand: true,
                    onPressed: () => context.push(Routes.login),
                  ),
                  const SizedBox(height: NlSpace.md),
                  NlButton(
                    label: l10n.welcomeCreateAccount,
                    kind: NlButtonKind.secondary,
                    expand: true,
                    onPressed: () => context.push(Routes.register),
                  ),
                  const SizedBox(height: NlSpace.xxxl),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
