import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Niro's expressions — same set and meaning as the web (lib/niro.ts).
/// Keep him intentional, never decorative: explaining for answers, victory
/// for correct/completed, challenge for quizzes/games, shocked rarely.
enum NiroExpression {
  normal,
  explaining,
  challenge,
  shocked,
  laughing,
  victory,
  fired,
  sleepy,
}

/// Niro, drawn from the SVGs exported from the web component
/// (tool/export_niro_svgs.tsx) — identical art on web and app.
class NiroImage extends StatelessWidget {
  const NiroImage({
    super.key,
    this.expression = NiroExpression.normal,
    this.size = 160,
  });

  /// Head-and-shoulders avatar (the web's `crop="head"`).
  const NiroImage.avatar({super.key, this.size = 40}) : expression = null;

  final NiroExpression? expression;

  /// Rendered width.
  final double size;

  @override
  Widget build(BuildContext context) {
    final asset = expression == null
        ? 'assets/niro/niro-avatar.svg'
        : 'assets/niro/niro-${expression!.name}.svg';
    return ExcludeSemantics(
      child: SvgPicture.asset(
        asset,
        width: size,
        // Bust art is 200×220; the avatar is square.
        height: expression == null ? size : size * 220 / 200,
      ),
    );
  }
}
