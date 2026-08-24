import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../storage/secure_store.dart';

class ApiConfig {
  static const String baseUrl = String.fromEnvironment('API_BASE_URL');
}

class ApiException implements Exception {
  ApiException(this.code, this.message, {this.status});
  final String code;
  final String message;
  // HTTP status of the failed response, when known. Needed so callers (e.g.
  // UploadQueue) can decide "is this a deterministic 4xx that a retry can
  // never fix" without trying to parse it back out of `code` -- real backend
  // error codes are semantic strings like FILE_TOO_LARGE or
  // VALIDATION_ERROR, not "HTTP_<status>", so that parsing never matched.
  final int? status;
  @override
  String toString() => '$code: $message';
}

class ApiClient {
  ApiClient(this.store, {String? baseUrl})
      : baseUrl = _normalizeBaseUrl(baseUrl ?? ApiConfig.baseUrl);

  static String _normalizeBaseUrl(String value) {
    final normalized = value.trim().replaceFirst(RegExp(r'/+$'), '');
    if (normalized.isEmpty) {
      throw ArgumentError('API_BASE_URL must be provided at build time.');
    }
    final uri = Uri.tryParse(normalized);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw ArgumentError('API_BASE_URL must be an absolute URL.');
    }
    if (kReleaseMode && uri.scheme != 'https') {
      throw ArgumentError('API_BASE_URL must use HTTPS in release builds.');
    }
    return normalized;
  }

  final SecureStore store;
  final String baseUrl;

  Future<void> Function()? onUnauthorized;
  Future<bool>? _refreshFuture;

  Future<dynamic> uploadFile(String path, File file, {bool auth = true}) async {
    return _uploadFile(path, file, auth: auth, retryAfterRefresh: true);
  }

  Future<dynamic> _uploadFile(String path, File file,
      {required bool auth, required bool retryAfterRefresh}) async {
    final response = await _sendMultipart(path, file, auth: auth);
    final decoded = response.body.isEmpty ? null : _decodeBody(response.body);
    if (response.statusCode == 401 && auth && retryAfterRefresh) {
      final refreshed = await _refreshAccessToken();
      if (refreshed)
        return _uploadFile(path, file, auth: auth, retryAfterRefresh: false);
      await _handleUnauthorized();
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _apiException(response.statusCode, decoded, 'Upload failed');
    }
    return decoded is Map && decoded.containsKey('data')
        ? decoded['data']
        : decoded;
  }

  Future<http.Response> _sendMultipart(String path, File file,
      {required bool auth}) async {
    final uri = Uri.parse('$baseUrl$path');
    final request = http.MultipartRequest('POST', uri);
    request.headers['Accept'] = 'application/json';
    if (auth) {
      final token = await store.accessToken;
      if (token == null || token.isEmpty) {
        // Not from the server -- no token present locally, so tag it 401
        // like an auth failure would be, so retry logic treats it the same
        // deterministic way (retrying won't help without a token either).
        throw ApiException('UNAUTHENTICATED', 'Authentication required',
            status: 401);
      }
      request.headers['Authorization'] = 'Bearer $token';
    }
    request.files.add(await http.MultipartFile.fromPath('file', file.path));
    final streamed = await request.send().timeout(const Duration(seconds: 60));
    return http.Response.fromStream(streamed);
  }

  Future<dynamic> request(String method, String path,
      {Object? body, bool auth = false}) async {
    final response = await _send(method, path, body: body, auth: auth);
    final decoded = response.body.isEmpty ? null : _decodeBody(response.body);
    if (response.statusCode == 401 && auth) {
      final refreshed = await _refreshAccessToken();
      if (refreshed) {
        final retry = await _send(method, path, body: body, auth: true);
        return _finishResponse(
            retry,
            retry.body.isEmpty ? null : _decodeBody(retry.body),
            'Request failed');
      }
      await _handleUnauthorized();
    }
    return _finishResponse(response, decoded, 'Request failed');
  }

  Future<http.Response> _send(String method, String path,
      {Object? body, required bool auth}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (auth) {
      final token = await store.accessToken;
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    final uri = Uri.parse('$baseUrl$path');
    final encoded = body == null ? null : jsonEncode(body);
    const timeout = Duration(seconds: 20);
    switch (method.toUpperCase()) {
      case 'GET':
        return http.get(uri, headers: headers).timeout(timeout);
      case 'POST':
        return http.post(uri, headers: headers, body: encoded).timeout(timeout);
      case 'PUT':
        return http.put(uri, headers: headers, body: encoded).timeout(timeout);
      case 'PATCH':
        return http
            .patch(uri, headers: headers, body: encoded)
            .timeout(timeout);
      case 'DELETE':
        return http.delete(uri, headers: headers).timeout(timeout);
      default:
        throw UnsupportedError('Unsupported HTTP method: $method');
    }
  }

  dynamic _decodeBody(String body) {
    try {
      return jsonDecode(body);
    } catch (_) {
      return body;
    }
  }

  ApiException _apiException(int status, dynamic decoded, String fallback) {
    final error = decoded is Map && decoded['error'] is Map
        ? decoded['error'] as Map
        : const {};
    return ApiException(
      '${error['code'] ?? 'HTTP_$status'}',
      '${error['message'] ?? fallback}',
      status: status,
    );
  }

  dynamic _finishResponse(
      http.Response response, dynamic decoded, String fallback) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _apiException(response.statusCode, decoded, fallback);
    }
    return decoded is Map && decoded.containsKey('data')
        ? decoded['data']
        : decoded;
  }

  Future<bool> _refreshAccessToken() async {
    final inFlight = _refreshFuture;
    if (inFlight != null) return inFlight;
    final future = _doRefreshAccessToken();
    _refreshFuture = future;
    try {
      return await future;
    } finally {
      if (identical(_refreshFuture, future)) _refreshFuture = null;
    }
  }

  Future<bool> _doRefreshAccessToken() async {
    final refresh = await store.refreshToken;
    if (refresh == null || refresh.isEmpty) return false;
    try {
      final response = await _send('POST', '/auth/refresh',
          auth: false, body: {'refreshToken': refresh});
      final decoded = response.body.isEmpty ? null : _decodeBody(response.body);
      if (response.statusCode < 200 || response.statusCode >= 300) return false;
      final data = decoded is Map && decoded['data'] is Map
          ? decoded['data'] as Map
          : null;
      if (data == null ||
          data['accessToken'] is! String ||
          data['refreshToken'] is! String) return false;
      await store.saveTokens(
        access: data['accessToken'] as String,
        refresh: data['refreshToken'] as String,
      );
      if (data['user'] is Map)
        await store.saveUser(Map<String, dynamic>.from(data['user'] as Map));
      return true;
    } catch (_) {
      return false;
    }
  }

  bool _handlingUnauthorized = false;
  Future<void> _handleUnauthorized() async {
    if (_handlingUnauthorized || onUnauthorized == null) return;
    _handlingUnauthorized = true;
    try {
      await onUnauthorized!();
    } finally {
      _handlingUnauthorized = false;
    }
  }
}
