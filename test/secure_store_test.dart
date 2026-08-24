import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/core/storage/secure_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // flutter_secure_storage 9.x Android channel name.
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

  setUp(() {
    // Mock the secure-storage platform channel so tests run without a device.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async => null);
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('SecureStore exposes token and user persistence API', () async {
    final store = SecureStore();
    expect(store.accessToken, isA<Future<String?>>());
    expect(store.refreshToken, isA<Future<String?>>());
    expect(store.user, isA<Future<Map<String, dynamic>?>>());
    // With an empty vault the getters resolve to null instead of throwing.
    expect(await store.accessToken, isNull);
    expect(await store.refreshToken, isNull);
    expect(await store.user, isNull);
  });
}
