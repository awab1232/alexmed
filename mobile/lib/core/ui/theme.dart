import 'package:flutter/material.dart';

import 'tokens.dart';

/// Type scale taken from the web's @nl-design block (app/globals.css):
/// h1 28/700/1.25 (mobile end of its clamp), sheet titles 18/700, list rows
/// 16/600, body 15/1.7, labels 13, bottom nav 12. Arabic is never
/// letter-spaced (the web's rule), so no style sets letterSpacing.
abstract final class NlText {
  static const _ui = NlFonts.ui;

  static const display = TextStyle(
    fontFamily: _ui,
    fontSize: 28,
    fontWeight: FontWeight.w700,
    height: 1.25,
    color: NlColors.ink,
  );
  static const title = TextStyle(
    fontFamily: _ui,
    fontSize: 18,
    fontWeight: FontWeight.w700,
    height: 1.4,
    color: NlColors.ink,
  );
  static const rowLabel = TextStyle(
    fontFamily: _ui,
    fontSize: 16,
    fontWeight: FontWeight.w600,
    height: 1.4,
    color: NlColors.ink,
  );
  static const body = TextStyle(
    fontFamily: _ui,
    fontSize: 15,
    fontWeight: FontWeight.w400,
    height: 1.7,
    color: NlColors.ink,
  );
  static const secondary = TextStyle(
    fontFamily: _ui,
    fontSize: 15,
    fontWeight: FontWeight.w400,
    height: 1.7,
    color: NlColors.ink3,
  );
  static const label = TextStyle(
    fontFamily: _ui,
    fontSize: 13,
    fontWeight: FontWeight.w600,
    height: 1.4,
    color: NlColors.ink3,
  );
  static const caption = TextStyle(
    fontFamily: _ui,
    fontSize: 13,
    fontWeight: FontWeight.w500,
    height: 1.4,
    color: NlColors.ink3,
  );
  static const button = TextStyle(
    fontFamily: _ui,
    fontSize: 15,
    fontWeight: FontWeight.w600,
    height: 1,
  );
  static const navLabel = TextStyle(
    fontFamily: _ui,
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 1.2,
  );

  /// Study text (summaries, notes, explanations): the web's reading face.
  static const reading = TextStyle(
    fontFamily: NlFonts.reading,
    fontFamilyFallback: [NlFonts.ui],
    fontSize: 17,
    fontWeight: FontWeight.w400,
    height: 1.95,
    color: NlColors.readingInk,
  );
}

ThemeData buildNiroTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: NlColors.ink,
    onPrimary: Colors.white,
    secondary: NlColors.niro,
    onSecondary: Colors.white,
    tertiary: NlColors.marker,
    onTertiary: NlColors.ink,
    error: NlColors.wrong,
    onError: Colors.white,
    surface: NlColors.sheet,
    onSurface: NlColors.ink,
    onSurfaceVariant: NlColors.ink3,
    outline: NlColors.ruleStrong,
    outlineVariant: NlColors.rule,
    surfaceContainerLowest: NlColors.sheet,
    surfaceContainerLow: NlColors.paper,
    surfaceContainer: NlColors.paper,
    surfaceContainerHigh: NlColors.sheet,
    surfaceContainerHighest: NlColors.sheet,
  );
  final roundedMd = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(NlRadius.md),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamily: NlFonts.ui,
    scaffoldBackgroundColor: NlColors.paper,
    canvasColor: NlColors.paper,
    dividerColor: NlColors.rule,
    splashFactory: InkSparkle.splashFactory,
    textTheme: const TextTheme(
      headlineMedium: NlText.display,
      titleLarge: NlText.title,
      titleMedium: NlText.rowLabel,
      bodyLarge: NlText.body,
      bodyMedium: NlText.body,
      bodySmall: NlText.caption,
      labelLarge: NlText.button,
      labelMedium: NlText.label,
      labelSmall: NlText.navLabel,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: NlColors.paper,
      foregroundColor: NlColors.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: NlText.title,
    ),
    dividerTheme: const DividerThemeData(
      color: NlColors.rule,
      thickness: 1,
      space: 1,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: NlColors.sheet,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      hintStyle: NlText.secondary,
      labelStyle: NlText.label,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(NlRadius.sm),
        borderSide: const BorderSide(color: NlColors.ruleStrong),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(NlRadius.sm),
        borderSide: const BorderSide(color: NlColors.ruleStrong),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(NlRadius.sm),
        borderSide: const BorderSide(color: NlColors.niro, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(NlRadius.sm),
        borderSide: const BorderSide(color: NlColors.wrong),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: NlColors.ink,
        foregroundColor: Colors.white,
        minimumSize: const Size(64, 48),
        textStyle: NlText.button,
        shape: roundedMd,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: NlColors.ink,
        backgroundColor: NlColors.sheet,
        minimumSize: const Size(64, 44),
        side: const BorderSide(color: NlColors.ruleStrong),
        textStyle: NlText.button.copyWith(fontSize: 14),
        shape: roundedMd,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: NlColors.niroDeep,
        minimumSize: const Size(48, 44),
        textStyle: NlText.button.copyWith(fontSize: 14),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: NlColors.sheet,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: NlColors.ruleStrong,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(NlRadius.lg)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: NlColors.sheet,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: NlText.title,
      contentTextStyle: NlText.body.copyWith(color: NlColors.ink2),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(NlRadius.lg),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: NlColors.ink,
      contentTextStyle: NlText.body.copyWith(color: Colors.white),
      behavior: SnackBarBehavior.floating,
      shape: roundedMd,
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: NlColors.ink,
      linearTrackColor: NlColors.rule,
    ),
  );
}
