import 'dart:async';
import 'dart:io';
import '../network/api_client.dart';

class PendingUpload {
  PendingUpload(
      {required this.jobId, required this.path, required this.filePath});
  final String jobId;
  final String path;
  final String filePath;
}

/// MVP upload queue with bounded retry/backoff. The queue is intentionally
/// in-memory; a durable local queue can replace this implementation later.
class UploadQueue {
  UploadQueue(this.api, {this.maxAttempts = 3});
  final ApiClient api;
  final int maxAttempts;
  final List<PendingUpload> _queue = [];
  bool _running = false;

  int get pendingCount => _queue.length;

  /// Uploads [file] to [path] immediately, retrying with backoff up to
  /// [maxAttempts] times, and returns the decoded response on success.
  /// Use this when the caller needs the response synchronously (e.g. to
  /// read back a storage key) instead of firing-and-forgetting via
  /// [enqueue]. Throws the last error if every attempt fails.
  Future<dynamic> uploadNowWithRetry(String path, File file) async {
    Object? lastError;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await api.uploadFile(path, file);
      } catch (e) {
        lastError = e;
        // Deterministic 4xx (bad file type, validation error, etc.) will
        // never succeed on retry. Real backend errors carry a semantic
        // `code` (e.g. FILE_TOO_LARGE), never "HTTP_<status>", so this must
        // check the actual HTTP status on the exception, not try to parse
        // one out of `code`.
        if (e is ApiException &&
            e.status != null &&
            e.status! >= 400 &&
            e.status! < 500) break;
        if (attempt < maxAttempts) {
          await Future<void>.delayed(Duration(milliseconds: 500 * attempt));
        }
      }
    }
    throw lastError!;
  }

  Future<void> enqueue(PendingUpload item) async {
    _queue.add(item);
    await drain();
  }

  Future<void> drain() async {
    if (_running) return;
    _running = true;
    try {
      while (_queue.isNotEmpty) {
        final item = _queue.first;
        final file = File(item.filePath);
        if (!await file.exists()) {
          _queue.removeAt(0);
          continue;
        }

        var sent = false;
        try {
          await uploadNowWithRetry(item.path, file);
          sent = true;
        } catch (_) {
          // Preserve the failed item for a later explicit drain/retry.
        }

        if (sent) {
          _queue.removeAt(0);
        } else {
          break;
        }
      }
    } finally {
      _running = false;
    }
  }
}
