import 'package:flutter/foundation.dart';
import '../network/api_client.dart';
import '../storage/secure_store.dart';

class AuthController extends ChangeNotifier {
  AuthController(this.api, this.store);
  final ApiClient api;
  final SecureStore store;

  bool loading = false;
  bool initialized = false;
  bool guest = true;
  Map<String, dynamic>? user;
  String? error;

  bool get isAuthenticated => user != null;
  bool get isGuest => guest && user == null;

  Future<void> restoreSession() async {
    try {
      final token = await store.accessToken;
      final savedUser = await store.user;
      if (token != null && token.isNotEmpty && savedUser != null) {
        user = savedUser;
        guest = false;
      } else {
        await store.clear();
        user = null;
        guest = true;
      }
    } finally {
      initialized = true;
      notifyListeners();
    }
  }

  void continueAsGuest() {
    user = null;
    guest = true;
    error = null;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    await _auth(() async {
      final data = await api.request('POST', '/auth/login',
          body: {'email': email, 'password': password});
      await _applySession(data);
    });
  }

  Future<void> register(
      String email, String password, String displayName) async {
    await _auth(() async {
      final data = await api.request('POST', '/auth/register', body: {
        'email': email,
        'password': password,
        'displayName': displayName
      });
      await _applySession(data);
    });
  }

  Future<void> _applySession(dynamic data) async {
    if (data is! Map || data['user'] is! Map) {
      throw const FormatException('Invalid authentication response');
    }
    final access = data['accessToken'];
    final refresh = data['refreshToken'];
    if (access is! String ||
        access.isEmpty ||
        refresh is! String ||
        refresh.isEmpty) {
      throw const FormatException('Authentication tokens were not returned');
    }
    final account = Map<String, dynamic>.from(data['user'] as Map);
    // Persist first; only then publish the authenticated state. This avoids
    // a false-positive login if secure storage itself fails.
    await store.saveTokens(access: access, refresh: refresh);
    await store.saveUser(account);
    user = account;
    guest = false;
  }

  Future<void> logout({bool notifyServer = true}) async {
    try {
      if (notifyServer && user != null) {
        try {
          await api.request('POST', '/auth/logout', auth: true);
        } catch (_) {
          // Local session cleanup is the authoritative fallback.
        }
      }
    } finally {
      await store.clear();
      user = null;
      guest = true;
      notifyListeners();
    }
  }

  Future<void> _auth(Future<void> Function() fn) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      await fn();
    } catch (e) {
      error = e.toString();
      rethrow;
    } finally {
      loading = false;
      notifyListeners();
    }
  }
}
