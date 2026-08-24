import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/auth/auth_controller.dart';
import 'core/network/api_client.dart';
import 'core/storage/secure_store.dart';
import 'core/theme/theme_controller.dart';
import 'theme/app_theme.dart';
import 'core/router/app_router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final store = SecureStore();
  final api = ApiClient(store);
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeController()),
        ChangeNotifierProvider(
          create: (_) {
            final auth = AuthController(api, store);
            // If an authenticated request remains unauthorized after refresh,
            // clear the local session and return the app to guest mode.
            api.onUnauthorized = () => auth.logout(notifyServer: false);
            auth.restoreSession();
            return auth;
          },
        ),
      ],
      child: WorkMarketplaceApp(api: api),
    ),
  );
}

class WorkMarketplaceApp extends StatelessWidget {
  const WorkMarketplaceApp({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeController>();
    return MaterialApp(
      title: 'HOPE',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: theme.mode,
      home: AppRouter(api: api),
    );
  }
}
