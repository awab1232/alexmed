import 'package:flutter/material.dart';

import '../core/ui/ui.dart';
import '../l10n/app_localizations.dart';

/// Stand-in for a screen a later phase builds. Tracked in
/// docs/mobile/MOBILE_IMPLEMENTATION_ROADMAP.md — never counts as done.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({
    super.key,
    required this.title,
    required this.phase,
  });

  final String Function(AppLocalizations l10n) title;
  final String phase;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(title(l10n))),
      body: Center(
        child: Text(l10n.underConstruction(phase), style: NlText.secondary),
      ),
    );
  }
}
