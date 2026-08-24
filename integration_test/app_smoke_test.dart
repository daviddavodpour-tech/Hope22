import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:hope_mobile/main.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('HOPE boots on a real device surface', (tester) async {
    final api = ApiClient(SecureStore(), baseUrl: 'http://10.0.2.2:9/api/v1');
    await tester.pumpWidget(WorkMarketplaceApp(api: api));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.byType(MaterialApp), findsOneWidget);
    expect(
        find.bySemanticsLabel('HOPE').evaluate().isNotEmpty ||
            find.text('HOPE').evaluate().isNotEmpty,
        isTrue);
  });
}
