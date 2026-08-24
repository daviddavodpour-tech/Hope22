import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class AnimatedEntrance extends StatelessWidget {
  const AnimatedEntrance(
      {super.key,
      required this.child,
      this.delay = Duration.zero,
      this.offset = const Offset(0, .03)});
  final Widget child;
  final Duration delay;
  final Offset offset;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
        child: child,
        builder: (context, value, child) {
          final delayed = delay.inMilliseconds == 0
              ? value
              : Curves.easeOutCubic.transform(
                  ((value * 1000 - delay.inMilliseconds) / 1000).clamp(0, 1));
          return Opacity(
            opacity: delayed,
            child: Transform.translate(
              offset: Offset(offset.dx * (1 - delayed) * 24,
                  offset.dy * (1 - delayed) * 24),
              child: child,
            ),
          );
        },
      );
}

class PressableScale extends StatefulWidget {
  const PressableScale(
      {super.key,
      required this.child,
      required this.onTap,
      this.semanticLabel});
  final Widget child;
  final VoidCallback onTap;
  final String? semanticLabel;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool pressed = false;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: widget.semanticLabel,
        child: GestureDetector(
          onTap: widget.onTap,
          onTapDown: (_) => setState(() => pressed = true),
          onTapCancel: () => setState(() => pressed = false),
          onTapUp: (_) => setState(() => pressed = false),
          child: AnimatedScale(
            scale: pressed ? .975 : 1,
            duration: const Duration(milliseconds: 110),
            curve: Curves.easeOut,
            child: widget.child,
          ),
        ),
      );
}

class HopeSurface extends StatelessWidget {
  const HopeSurface(
      {super.key,
      required this.child,
      this.padding = EdgeInsets.zero,
      this.radius = 26,
      this.highlight = false});
  final Widget child;
  final EdgeInsets padding;
  final double radius;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final border =
        dark ? Colors.white.withValues(alpha: .07) : const Color(0xFFE7E3F0);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: dark ? AppColors.darkCard : AppColors.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(
            color:
                highlight ? AppColors.primary.withValues(alpha: .20) : border),
        boxShadow: dark
            ? const []
            : const [
                BoxShadow(
                    color: Color(0x0A211A44),
                    blurRadius: 26,
                    offset: Offset(0, 10))
              ],
      ),
      child: child,
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(
      {super.key, required this.title, this.subtitle, this.action});
  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium)
                ],
              ])),
          if (action != null) action!,
        ],
      );
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.label,
      {super.key, this.color = AppColors.primary, this.icon});
  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
            color: color.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 5)
          ],
          Semantics(
              label: label,
              child: Text(label,
                  style: TextStyle(
                      color: color,
                      fontSize: 11,
                      fontWeight: FontWeight.w900))),
        ]),
      );
}

class HopeIconTile extends StatelessWidget {
  const HopeIconTile(this.icon,
      {super.key,
      this.color = AppColors.primary,
      this.size = 46,
      this.filled = false});
  final IconData icon;
  final Color color;
  final double size;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final fill = filled ? color : color.withValues(alpha: .10);
    final iconColor = filled ? Colors.white : color;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
          color: fill, borderRadius: BorderRadius.circular(size * .30)),
      child: Icon(icon, color: iconColor, size: size * .48),
    );
  }
}

class MetricTile extends StatelessWidget {
  const MetricTile(
      {super.key,
      required this.label,
      required this.value,
      this.icon,
      this.color = AppColors.primary});
  final String label;
  final String value;
  final IconData? icon;
  final Color color;

  @override
  Widget build(BuildContext context) => HopeSurface(
        padding: const EdgeInsets.all(16),
        child: Row(children: [
          if (icon != null) ...[
            HopeIconTile(icon!, color: color),
            const SizedBox(width: 12)
          ],
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(label, style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 4),
                Text(value,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium),
              ])),
        ]),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState(
      {super.key,
      required this.icon,
      required this.title,
      required this.message,
      this.action});
  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: HopeSurface(
            padding: const EdgeInsets.all(28),
            highlight: true,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              HopeIconTile(icon, size: 70, filled: true),
              const SizedBox(height: 17),
              Text(title,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(message,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium),
              if (action != null) ...[const SizedBox(height: 18), action!],
            ]),
          ),
        ),
      );
}

class GradientHero extends StatelessWidget {
  const GradientHero(
      {super.key,
      required this.eyebrow,
      required this.title,
      required this.message,
      required this.icon,
      this.action});
  final String eyebrow;
  final String title;
  final String message;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF5D43E8), Color(0xFF8B73FF), Color(0xFFB09FFF)],
            stops: [0, .55, 1],
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
          ),
          borderRadius: BorderRadius.circular(31),
          boxShadow: const [
            BoxShadow(
                color: Color(0x2B6C4DFF), blurRadius: 32, offset: Offset(0, 16))
          ],
        ),
        child: Stack(children: [
          Positioned(
              right: -28,
              top: -38,
              child: Container(
                  width: 150,
                  height: 150,
                  decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .08),
                      shape: BoxShape.circle))),
          Positioned(
              left: -36,
              bottom: -55,
              child: Container(
                  width: 170,
                  height: 170,
                  decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .06),
                      shape: BoxShape.circle))),
          Padding(
            padding: const EdgeInsets.all(22),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(eyebrow,
                        style: const TextStyle(
                            color: Colors.white70,
                            fontWeight: FontWeight.w800,
                            letterSpacing: .2)),
                    const SizedBox(height: 8),
                    Text(title,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 25,
                            height: 1.10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -.5)),
                    const SizedBox(height: 9),
                    Text(message,
                        style: const TextStyle(
                            color: Colors.white70, height: 1.45)),
                    if (action != null) ...[
                      const SizedBox(height: 18),
                      action!
                    ],
                  ])),
              const SizedBox(width: 14),
              Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .14),
                      borderRadius: BorderRadius.circular(19),
                      border: Border.all(color: Colors.white24)),
                  child: Icon(icon, color: Colors.white, size: 29)),
            ]),
          ),
        ]),
      );
}

class SearchField extends StatelessWidget {
  const SearchField(
      {super.key,
      required this.onChanged,
      this.onFilter,
      this.hint = 'جست‌وجو کن...'});
  final ValueChanged<String> onChanged;
  final VoidCallback? onFilter;
  final String hint;

  @override
  Widget build(BuildContext context) => Semantics(
        label: hint,
        textField: true,
        child: TextField(
          onChanged: onChanged,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.search_rounded),
            hintText: hint,
            suffixIcon: onFilter == null
                ? null
                : IconButton(
                    tooltip: 'فیلترها',
                    onPressed: onFilter,
                    icon: const Icon(Icons.tune_rounded),
                  ),
          ),
        ),
      );
}
