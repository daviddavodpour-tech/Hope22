import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../auth/auth_controller.dart';
import '../network/api_client.dart';
import '../../features/auth/login_page.dart';
import '../../features/home/home_page.dart';

class AppRouter extends StatelessWidget {
  const AppRouter({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    if (!auth.initialized) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    // HOPE is browse-first: an account is optional for entering the app.
    // Mutating/account-only actions remain protected by the UI and API.
    return auth.isAuthenticated || auth.isGuest
        ? HomePage(api: api)
        : LoginPage(api: api);
  }
}
