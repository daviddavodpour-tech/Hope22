import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/network/api_client.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

void main() {
  test('ApiClient requires an explicit build-time API base URL', () {
    expect(() => ApiClient(SecureStore()), throwsArgumentError);
  });

  test('ApiClient accepts an injected base URL (e.g. Android emulator)', () {
    final client =
        ApiClient(SecureStore(), baseUrl: 'http://10.0.2.2:3000/api/v1');
    expect(client.baseUrl, contains('/api/v1'));
  });
}
