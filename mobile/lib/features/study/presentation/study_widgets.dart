import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/study_repository.dart';

/// End of a session (review / quiz): Niro, a title, a line, actions.
class StudyResult extends StatelessWidget {
  const StudyResult({
    super.key,
    required this.expression,
    required this.title,
    required this.body,
    required this.actions,
  });

  final NiroExpression expression;
  final String title;
  final String body;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(NlSpace.xl),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            NiroImage(expression: expression, size: 120),
            const SizedBox(height: NlSpace.lg),
            Text(title, style: NlText.display, textAlign: TextAlign.center),
            const SizedBox(height: NlSpace.sm),
            Text(body, style: NlText.secondary, textAlign: TextAlign.center),
            const SizedBox(height: NlSpace.xl),
            for (final (i, action) in actions.indexed) ...[
              if (i > 0) const SizedBox(height: NlSpace.sm),
              action,
            ],
          ],
        ),
      ),
    ),
  );
}

/// "QUESTION / السؤال" then the English (LTR) and Arabic (RTL) texts.
class BilingualBlock extends StatelessWidget {
  const BilingualBlock({
    super.key,
    required this.label,
    required this.en,
    required this.ar,
    this.strong = false,
  });

  final String label;
  final String en;
  final String ar;
  final bool strong;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: NlSpace.lg),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(isolateLtr(label), style: NlText.label),
        const SizedBox(height: 4),
        if (en.isNotEmpty)
          Text(
            en,
            textDirection: TextDirection.ltr,
            style: NlText.body.copyWith(
              fontWeight: strong ? FontWeight.w700 : null,
            ),
          ),
        if (ar.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(ar, textDirection: TextDirection.rtl, style: NlText.reading),
        ],
      ],
    ),
  );
}

/// The PDF page a card / question came from. The server redirects to a
/// short-lived signed storage URL, which is loaded without the session.
Future<void> showPageImageSheet(
  BuildContext context, {
  required String bookId,
  required int page,
}) {
  final l10n = AppLocalizations.of(context);
  return showNlSheet<void>(
    context,
    title: l10n.flashSourceTitle(page),
    builder: (_) => _PageImage(bookId: bookId, page: page),
  );
}

class _PageImage extends ConsumerStatefulWidget {
  const _PageImage({required this.bookId, required this.page});

  final String bookId;
  final int page;

  @override
  ConsumerState<_PageImage> createState() => _PageImageState();
}

class _PageImageState extends ConsumerState<_PageImage> {
  late final Future<String?> _url = ref
      .read(studyRepositoryProvider)
      .pageImageUrl(widget.bookId, widget.page);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final failed = Padding(
      padding: const EdgeInsets.all(NlSpace.xl),
      child: Text(
        l10n.sourceImageFailed,
        style: NlText.secondary,
        textAlign: TextAlign.center,
      ),
    );
    return FutureBuilder<String?>(
      future: _url,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const SizedBox(
            height: 240,
            child: Center(child: CircularProgressIndicator()),
          );
        }
        final url = snapshot.data;
        if (snapshot.hasError || url == null) return failed;
        return ClipRRect(
          borderRadius: BorderRadius.circular(NlRadius.md),
          child: InteractiveViewer(
            maxScale: 5,
            child: Image.network(
              url,
              fit: BoxFit.contain,
              loadingBuilder: (context, child, progress) => progress == null
                  ? child
                  : const SizedBox(
                      height: 240,
                      child: Center(child: CircularProgressIndicator()),
                    ),
              errorBuilder: (_, _, _) => failed,
            ),
          ),
        );
      },
    );
  }
}
