import 'dart:async';

/// Platform-neutral notification abstraction. Firebase/FCM wiring is intentionally
/// isolated so the app can run without a project-specific Firebase config.
class NotificationService {
  final StreamController<String> _events = StreamController.broadcast();

  Stream<String> get events => _events.stream;

  Future<void> initialize() async {
    // Register native push provider here when Firebase configuration is supplied.
  }

  void publishLocal(String event) => _events.add(event);

  Future<void> dispose() => _events.close();
}
