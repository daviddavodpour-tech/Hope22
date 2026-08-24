import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/theme_controller.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/components.dart';
import '../../theme/app_theme.dart';
import '../auth/login_page.dart';
import '../auth/register_page.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key, required this.api});
  final ApiClient api;
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Future<dynamic>? profile;
  String? loadedUserId;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final id = context.read<AuthController>().user?['id']?.toString();
    if (id != loadedUserId) {
      loadedUserId = id;
      profile = id == null
          ? null
          : widget.api
              .request('GET', '/providers/me', auth: true)
              .catchError((_) => null);
    }
  }

  void _openLogin() => Navigator.push(
      context, MaterialPageRoute(builder: (_) => LoginPage(api: widget.api)));
  void _openRegister() => Navigator.push(context,
      MaterialPageRoute(builder: (_) => RegisterPage(api: widget.api)));

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final theme = context.watch<ThemeController>();
    if (auth.isGuest) {
      return ListView(
          padding: const EdgeInsets.fromLTRB(20, 17, 20, 122),
          children: [
            const HopeMark(),
            const SizedBox(height: 28),
            Text('پروفایل', style: Theme.of(context).textTheme.displaySmall),
            const SizedBox(height: 6),
            Text('هویت حرفه‌ای تو از اینجا شروع می‌شود.',
                style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 20),
            GradientHero(
                eyebrow: 'حساب HOPE',
                title: 'یک خانه برای مسیر حرفه‌ای تو.',
                message:
                    'پروفایل، معاملات، ثبت کار و تنظیماتت را یکجا مدیریت کن.',
                icon: Icons.person_rounded,
                action: Row(children: [
                  Expanded(
                      child: FilledButton(
                          style: FilledButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: AppColors.primary),
                          onPressed: _openRegister,
                          child: const Text('ساخت حساب'))),
                  const SizedBox(width: 8),
                  Expanded(
                      child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: const BorderSide(color: Colors.white54)),
                          onPressed: _openLogin,
                          child: const Text('ورود')))
                ])),
            const SizedBox(height: 20),
            _settingsCard(theme),
          ]);
    }
    final user = auth.user;
    final displayName = '${user?['displayName'] ?? 'HOPE'}';
    final initial =
        displayName.isEmpty ? 'H' : displayName.characters.first.toUpperCase();
    return ListView(
        padding: const EdgeInsets.fromLTRB(20, 17, 20, 122),
        children: [
          Row(children: [
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text('پروفایل',
                      style: Theme.of(context).textTheme.displaySmall),
                  const SizedBox(height: 5),
                  Text('هویت حرفه‌ای و تنظیمات حساب',
                      style: Theme.of(context).textTheme.bodyLarge)
                ])),
            const HopeMark(size: 40, showText: false)
          ]),
          const SizedBox(height: 18),
          HopeSurface(
              padding: const EdgeInsets.all(20),
              highlight: true,
              child: Row(children: [
                CircleAvatar(
                    radius: 32,
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    child: Text(initial,
                        style: const TextStyle(
                            fontWeight: FontWeight.w900, fontSize: 23))),
                const SizedBox(width: 15),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(displayName,
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 5),
                      Text('${user?['email'] ?? ''}',
                          style: Theme.of(context).textTheme.bodyMedium),
                      const SizedBox(height: 8),
                      const StatusPill('حساب فعال',
                          color: AppColors.success,
                          icon: Icons.verified_rounded)
                    ]))
              ])),
          const SizedBox(height: 18),
          const SectionTitle(
              title: 'وضعیت حرفه‌ای', subtitle: 'جزئیات حساب و ظرفیت همکاری'),
          const SizedBox(height: 12),
          FutureBuilder(
              future: profile,
              builder: (context, snapshot) {
                final data = snapshot.data is Map
                    ? snapshot.data as Map
                    : const <dynamic, dynamic>{};
                return Column(children: [
                  Row(children: [
                    Expanded(
                        child: MetricTile(
                            label: 'نوع فعالیت',
                            value: '${data['providerType'] ?? '—'}',
                            icon: Icons.badge_outlined)),
                    const SizedBox(width: 10),
                    Expanded(
                        child: MetricTile(
                            label: 'ظرفیت',
                            value: '${data['capacity'] ?? '—'}',
                            icon: Icons.speed_rounded,
                            color: AppColors.secondary))
                  ]),
                  const SizedBox(height: 10),
                  MetricTile(
                      label: 'احراز هویت',
                      value: '${data['verificationStatus'] ?? '—'}',
                      icon: Icons.verified_user_outlined)
                ]);
              }),
          const SizedBox(height: 20),
          _settingsCard(theme, onLogout: auth.logout),
        ]);
  }

  Widget _settingsCard(ThemeController theme, {VoidCallback? onLogout}) =>
      HopeSurface(
          child: Column(children: [
        Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(children: [
              const HopeIconTile(Icons.tune_rounded, filled: true, size: 42),
              const SizedBox(width: 11),
              Text('تنظیمات', style: Theme.of(context).textTheme.titleMedium)
            ])),
        SwitchListTile.adaptive(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
            secondary: HopeIconTile(theme.isDark
                ? Icons.dark_mode_rounded
                : Icons.light_mode_rounded),
            title: const Text('حالت تاریک',
                style: TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text(theme.isDark ? 'فعال است' : 'برای محیط کم‌نور',
                style: Theme.of(context).textTheme.bodyMedium),
            value: theme.isDark,
            onChanged: (_) => theme.toggle()),
        const Divider(height: 1),
        ListTile(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
            leading: const HopeIconTile(Icons.info_outline_rounded),
            title: const Text('درباره HOPE',
                style: TextStyle(fontWeight: FontWeight.w800)),
            subtitle: const Text('Work • Grow • Together'),
            onTap: () => showAboutDialog(
                context: context,
                applicationName: 'HOPE',
                applicationVersion: '3.5.0',
                applicationLegalese: 'Marketplace for meaningful work.')),
        if (onLogout != null) ...[
          const Divider(height: 1),
          ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              leading: const HopeIconTile(Icons.logout_rounded,
                  color: AppColors.danger),
              title: const Text('خروج از حساب',
                  style: TextStyle(
                      color: AppColors.danger, fontWeight: FontWeight.w800)),
              onTap: onLogout)
        ],
      ]));
}
