import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class AppColors {
  static const primary = Color(0xFF6C4DFF);
  static const primaryDark = Color(0xFFB3A2FF);
  static const secondary = Color(0xFF22B8A7);
  static const ink = Color(0xFF151326);
  static const muted = Color(0xFF77738C);
  static const surface = Color(0xFFFFFFFF);
  static const background = Color(0xFFF6F5FC);
  static const success = Color(0xFF12A579);
  static const warning = Color(0xFFF2A43A);
  static const danger = Color(0xFFE35D65);
  static const softPrimary = Color(0xFFEAE5FF);
  static const darkBackground = Color(0xFF0C0A12);
  static const darkSurface = Color(0xFF15131D);
  static const darkCard = Color(0xFF1C1925);
  static const darkText = Color(0xFFF8F7FC);
  static const darkMuted = Color(0xFFAAA6B8);
}

class AppTheme {
  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: brightness,
      primary: dark ? AppColors.primaryDark : AppColors.primary,
      secondary: AppColors.secondary,
      surface: dark ? AppColors.darkSurface : AppColors.surface,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor:
          dark ? AppColors.darkBackground : AppColors.background,
      visualDensity: VisualDensity.standard,
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
        TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
      }),
    );

    final textColor = dark ? AppColors.darkText : AppColors.ink;
    final mutedColor = dark ? AppColors.darkMuted : AppColors.muted;

    return base.copyWith(
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        foregroundColor: textColor,
        centerTitle: false,
        titleTextStyle: TextStyle(
            fontSize: 21,
            fontWeight: FontWeight.w900,
            color: textColor,
            letterSpacing: -.3),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: dark ? AppColors.darkCard : AppColors.surface,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
      ),
      dividerTheme: DividerThemeData(
          color: dark ? Colors.white10 : const Color(0xFFE8E5F0), space: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? const Color(0xFF201D28) : const Color(0xFFFCFBFF),
        hintStyle: TextStyle(color: mutedColor),
        labelStyle: TextStyle(color: mutedColor, fontWeight: FontWeight.w700),
        prefixIconColor: mutedColor,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 17, vertical: 17),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide.none),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide(
                color: dark ? Colors.white10 : const Color(0xFFE6E2F0))),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide(color: scheme.primary, width: 1.6)),
        errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: AppColors.danger)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          padding: const EdgeInsets.symmetric(horizontal: 18),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          textStyle:
              const TextStyle(fontWeight: FontWeight.w900, letterSpacing: -.1),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          side: BorderSide(
              color: dark ? Colors.white12 : const Color(0xFFDED9EA)),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
              minimumSize: const Size(48, 48),
              textStyle: const TextStyle(fontWeight: FontWeight.w800))),
      iconButtonTheme: IconButtonThemeData(
          style: IconButton.styleFrom(
              minimumSize: const Size(48, 48),
              tapTargetSize: MaterialTapTargetSize.padded)),
      navigationBarTheme: NavigationBarThemeData(
        height: 78,
        backgroundColor:
            dark ? const Color(0xF714121B) : const Color(0xFDFEFEFF),
        surfaceTintColor: Colors.transparent,
        indicatorColor: dark ? const Color(0x4D7660FF) : AppColors.softPrimary,
        labelTextStyle: WidgetStateProperty.all(
            const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: scheme.primary,
        foregroundColor: Colors.white,
        elevation: 7,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(19)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: dark ? AppColors.darkCard : AppColors.ink,
        contentTextStyle:
            const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: scheme.primary),
      textTheme: TextTheme(
        displaySmall: TextStyle(
            fontSize: 35,
            fontWeight: FontWeight.w900,
            height: 1.03,
            letterSpacing: -.9,
            color: textColor),
        headlineMedium: TextStyle(
            fontSize: 29,
            fontWeight: FontWeight.w900,
            letterSpacing: -.6,
            color: textColor),
        headlineSmall: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            height: 1.08,
            letterSpacing: -.45,
            color: textColor),
        titleLarge: TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.w900,
            letterSpacing: -.2,
            color: textColor),
        titleMedium: TextStyle(
            fontSize: 15, fontWeight: FontWeight.w800, color: textColor),
        bodyLarge: TextStyle(fontSize: 15, height: 1.55, color: textColor),
        bodyMedium: TextStyle(fontSize: 13, height: 1.5, color: mutedColor),
        labelLarge: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
      ),
    );
  }
}
