import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Thin, testable wrapper around flutter_secure_storage.
/// Keeps authentication material and the serialized user profile out of
/// normal app preferences and exposes a stable API to the rest of the app.
class SecureStore {
  SecureStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _accessKey = 'hope.access_token';
  static const _refreshKey = 'hope.refresh_token';
  static const _userKey = 'hope.user';

  final FlutterSecureStorage _storage;

  Future<String?> get accessToken => _storage.read(key: _accessKey);
  Future<String?> get refreshToken => _storage.read(key: _refreshKey);

  Future<Map<String, dynamic>?> get user async {
    final raw = await _storage.read(key: _userKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map ? Map<String, dynamic>.from(decoded) : null;
    } catch (_) {
      return null;
    }
  }

  Future<void> saveTokens(
      {required String access, required String refresh}) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  Future<void> saveUser(Map<String, dynamic> value) async {
    await _storage.write(key: _userKey, value: jsonEncode(value));
  }

  Future<void> clear() async {
    await Future.wait([
      _storage.delete(key: _accessKey),
      _storage.delete(key: _refreshKey),
      _storage.delete(key: _userKey),
    ]);
  }
}
