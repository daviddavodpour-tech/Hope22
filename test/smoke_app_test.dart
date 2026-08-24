import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/main.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

void main() {
  testWidgets('app boots into a real top-level surface', (tester) async {
    await tester.pumpWidget(WorkMarketplaceApp(
        api: ApiClient(SecureStore(), baseUrl: 'http://127.0.0.1:9/api/v1')));
    await tester.pump();
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
