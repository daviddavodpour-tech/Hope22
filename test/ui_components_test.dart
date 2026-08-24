import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/ui/components.dart';
import 'package:hope_mobile/theme/app_theme.dart';

void main() {
  testWidgets('premium components render with accessible semantics',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light(),
      home: const Scaffold(
        body: Column(
          children: [
            StatusPill('منتشر شده', icon: Icons.check_circle_outline_rounded),
            HopeIconTile(Icons.work_rounded),
            SearchField(onChanged: _noop),
          ],
        ),
      ),
    ));
    expect(find.text('منتشر شده'), findsOneWidget);
    expect(find.byIcon(Icons.work_rounded), findsOneWidget);
    expect(find.bySemanticsLabel('جست‌وجو کن...'), findsOneWidget);
  });

  testWidgets('pressable scale exposes button semantics', (tester) async {
    var tapped = false;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: PressableScale(
          semanticLabel: 'عمل آزمایشی',
          onTap: () => tapped = true,
          child: const Text('انجام'),
        ),
      ),
    ));
    expect(find.bySemanticsLabel('عمل آزمایشی'), findsOneWidget);
    await tester.tap(find.text('انجام'));
    await tester.pump();
    expect(tapped, isTrue);
  });
}

void _noop(String _) {}
