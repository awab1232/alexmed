import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../l10n/app_localizations.dart';
import '../../api/api_error.dart';
import '../theme.dart';
import '../tokens.dart';
import 'niro.dart';
import 'nl_button.dart';

/// Student-facing text for an API failure in the current language. Messages
/// the server wrote for the student (Arabic) are kept as they are.
String apiErrorText(BuildContext context, Object error) {
  final l10n = AppLocalizations.of(context);
  return switch (error) {
    NetworkException() => l10n.errorNetwork,
    UnauthorizedException() => l10n.errorSessionExpired,
    PlanLimitException(:final details) => details.title,
    ForbiddenException(:final message) ||
    NotFoundException(:final message) ||
    RateLimitedException(:final message) ||
    RejectedException(:final message) ||
    ServerException(:final message) => message,
    _ => l10n.errorServer,
  };
}

/// Empty screen = an invitation to act (web `.empty-state`): Niro, a title,
/// one sentence, one action.
class NlEmptyState extends StatelessWidget {
  const NlEmptyState({
    super.key,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
    this.expression = NiroExpression.normal,
  });

  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final NiroExpression expression;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(
          horizontal: NlSpace.xl,
          vertical: 56,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              NiroImage(expression: expression, size: 120),
              const SizedBox(height: 14),
              Text(title, style: NlText.title, textAlign: TextAlign.center),
              if (message != null) ...[
                const SizedBox(height: 6),
                Text(
                  message!,
                  style: NlText.secondary,
                  textAlign: TextAlign.center,
                ),
              ],
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: NlSpace.xl),
                NlButton(label: actionLabel!, onPressed: onAction),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A failed load: what went wrong, in words, and how to fix it (retry).
class NlErrorView extends StatelessWidget {
  const NlErrorView({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final offline = error is NetworkException;
    return NlEmptyState(
      expression: offline ? NiroExpression.sleepy : NiroExpression.shocked,
      title: l10n.errorTitle,
      message: apiErrorText(context, error),
      actionLabel: onRetry == null ? null : l10n.actionRetry,
      onAction: onRetry,
    );
  }
}

/// Shown above cached content while offline (blueprint §14).
class NlOfflineBanner extends StatelessWidget {
  const NlOfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        color: NlColors.markerSoft,
        padding: const EdgeInsets.symmetric(
          horizontal: NlSpace.lg,
          vertical: NlSpace.sm,
        ),
        child: Row(
          children: [
            const Icon(LucideIcons.wifiOff, size: 16, color: NlColors.ink2),
            const SizedBox(width: NlSpace.sm),
            Expanded(
              child: Text(
                AppLocalizations.of(context).offlineBanner,
                style: NlText.caption.copyWith(color: NlColors.ink2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Placeholder block for first loads. A soft pulse, or static when the
/// system asks for reduced motion.
class NlSkeleton extends StatefulWidget {
  const NlSkeleton({
    super.key,
    this.width = double.infinity,
    this.height = 16,
    this.radius = NlRadius.sm,
  });

  final double width;
  final double height;
  final double radius;

  @override
  State<NlSkeleton> createState() => _NlSkeletonState();
}

class _NlSkeletonState extends State<NlSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _controller.stop();
    } else if (!_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: FadeTransition(
        opacity: Tween<double>(begin: 1, end: 0.55).animate(_controller),
        child: Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: NlColors.rule,
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        ),
      ),
    );
  }
}

/// Skeleton for a grouped list while it loads.
class NlListSkeleton extends StatelessWidget {
  const NlListSkeleton({super.key, this.rows = 4});

  final int rows;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: AppLocalizations.of(context).loading,
      child: Column(
        children: [
          for (var i = 0; i < rows; i++)
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: NlSpace.lg,
                vertical: NlSpace.md,
              ),
              child: Row(
                children: [
                  const NlSkeleton(width: 34, height: 34, radius: 10),
                  const SizedBox(width: NlSpace.md),
                  Expanded(
                    child: NlSkeleton(height: 14, width: i.isEven ? 180 : 130),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
