import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class HopeMark extends StatelessWidget {
  const HopeMark({super.key, this.size = 44, this.showText = true});
  final double size;
  final bool showText;
  @override
  Widget build(BuildContext context) {
    final mark = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFB1A2FF), AppColors.primary]),
        borderRadius: BorderRadius.circular(size * .30),
        boxShadow: const [
          BoxShadow(
              color: Color(0x2C6D4AFF), blurRadius: 18, offset: Offset(0, 8))
        ],
      ),
      child: Center(
          child: Icon(Icons.auto_awesome_rounded,
              size: size * .49, color: Colors.white)),
    );
    if (!showText) return mark;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      mark,
      const SizedBox(width: 10),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('HOPE',
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w900, letterSpacing: .8)),
        Text('work • grow • together',
            style: Theme.of(context)
                .textTheme
                .labelSmall
                ?.copyWith(letterSpacing: .15)),
      ]),
    ]);
  }
}

class SoftPill extends StatelessWidget {
  const SoftPill(
      {super.key,
      required this.icon,
      required this.label,
      this.color = AppColors.primary});
  final IconData icon;
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
        decoration: BoxDecoration(
            color: color.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 6),
          Text(label,
              style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w900, color: color))
        ]),
      );
}
