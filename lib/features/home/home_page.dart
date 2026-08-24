import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/network/api_client.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/components.dart';
import '../../theme/app_theme.dart';
import '../jobs/jobs_page.dart';
import '../marketplace/create_job_page.dart';
import '../profile/profile_page.dart';
import '../transactions/transactions_page.dart';
import '../auth/login_page.dart';
import '../auth/register_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.api});
  final ApiClient api;
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int tab = 0;
  late final List<Widget?> _tabs = List<Widget?>.filled(4, null);
  Widget _buildTab(int index) => _tabs[index] ??= switch (index) {
        0 => _HomeFeed(key: const ValueKey('home-feed'), api: widget.api),
        1 => JobsPage(key: const ValueKey('jobs'), api: widget.api),
        2 => TransactionsPage(
            key: const ValueKey('transactions'), api: widget.api),
        3 => ProfilePage(key: const ValueKey('profile'), api: widget.api),
        _ => const SizedBox.shrink(),
      };
  void _selectTab(int value) {
    if (value == tab) return;
    setState(() => tab = value);
  }

  @override
  Widget build(BuildContext context) {
    final current = _buildTab(tab);
    return Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          body: SafeArea(
              child: IndexedStack(
                  index: tab,
                  children: List.generate(
                      4,
                      (i) =>
                          _tabs[i] ??
                          (i == tab ? current : const SizedBox.shrink())))),
          floatingActionButton: tab == 0
              ? FloatingActionButton.extended(
                  onPressed: () {
                    final auth = context.read<AuthController>();
                    if (auth.isGuest) {
                      _showSignIn(context, widget.api);
                      return;
                    }
                    Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => CreateJobPage(api: widget.api)));
                  },
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('ثبت کار'),
                )
              : null,
          bottomNavigationBar: NavigationBar(
            selectedIndex: tab,
            onDestinationSelected: _selectTab,
            destinations: const [
              NavigationDestination(
                  icon: Icon(Icons.space_dashboard_outlined),
                  selectedIcon: Icon(Icons.space_dashboard_rounded),
                  label: 'خانه'),
              NavigationDestination(
                  icon: Icon(Icons.travel_explore_outlined),
                  selectedIcon: Icon(Icons.travel_explore_rounded),
                  label: 'کشف'),
              NavigationDestination(
                  icon: Icon(Icons.swap_horiz_rounded),
                  selectedIcon: Icon(Icons.swap_horizontal_circle_rounded),
                  label: 'فعالیت'),
              NavigationDestination(
                  icon: Icon(Icons.person_outline_rounded),
                  selectedIcon: Icon(Icons.person_rounded),
                  label: 'پروفایل'),
            ],
          ),
        ));
  }
}

void _showSignIn(BuildContext context, ApiClient api) {
  showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (sheetContext) => SafeArea(
              child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 4, 22, 28),
            child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const HopeMark(size: 42),
                  const SizedBox(height: 18),
                  Text('یک حساب حرفه‌ای بساز',
                      style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 8),
                  Text(
                      'کشف پروژه‌ها آزاد است؛ برای ثبت کار و پیشنهاد دادن وارد شو.',
                      style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                      onPressed: () {
                        Navigator.pop(sheetContext);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => RegisterPage(api: api)));
                      },
                      icon: const Icon(Icons.person_add_alt_1_rounded),
                      label: const Text('ساخت حساب')),
                  const SizedBox(height: 9),
                  OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(sheetContext);
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => LoginPage(api: api)));
                      },
                      icon: const Icon(Icons.login_rounded),
                      label: const Text('ورود به حساب')),
                ]),
          )));
}

class _HomeFeed extends StatelessWidget {
  const _HomeFeed({super.key, required this.api});
  final ApiClient api;
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final name = auth.isGuest
        ? 'دوست HOPE'
        : '${auth.user?['displayName'] ?? 'دوست HOPE'}';
    return ListView(
        padding: const EdgeInsets.fromLTRB(20, 17, 20, 122),
        children: [
          AnimatedEntrance(
              child: Row(children: [
            const Expanded(child: HopeMark()),
            DecoratedBox(
              decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(17),
                  border: Border.all(color: Theme.of(context).dividerColor)),
              child: IconButton(
                  onPressed: () =>
                      auth.isGuest ? _showSignIn(context, api) : auth.logout(),
                  tooltip: auth.isGuest ? 'ورود' : 'خروج',
                  icon: Icon(auth.isGuest
                      ? Icons.login_rounded
                      : Icons.logout_rounded)),
            )
          ])),
          const SizedBox(height: 28),
          AnimatedEntrance(
              delay: const Duration(milliseconds: 40),
              child: Text('سلام $name 👋',
                  style: Theme.of(context).textTheme.displaySmall)),
          const SizedBox(height: 7),
          AnimatedEntrance(
              delay: const Duration(milliseconds: 80),
              child: Text('امروز یک فرصت خوب برای جلو رفتن داری.',
                  style: Theme.of(context).textTheme.bodyLarge)),
          const SizedBox(height: 20),
          AnimatedEntrance(
              delay: const Duration(milliseconds: 120),
              child: GradientHero(
                eyebrow: auth.isGuest ? 'HOPE • مهمان' : 'HOPE • فضای کار',
                title: auth.isGuest
                    ? 'اول کشف کن، بعد شروع کن.'
                    : 'کار درست، آدم درست را پیدا می‌کند.',
                message: auth.isGuest
                    ? 'پروژه‌ها را ببین و وقتی آماده بودی، یک حساب بساز.'
                    : 'پروژه جدیدت را منتشر کن یا فرصت بعدی خودت را پیدا کن.',
                icon: auth.isGuest
                    ? Icons.travel_explore_rounded
                    : Icons.auto_awesome_rounded,
                action: FilledButton(
                    style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.primary,
                        minimumSize: const Size(0, 46)),
                    onPressed: () => auth.isGuest
                        ? _showSignIn(context, api)
                        : Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => CreateJobPage(api: api))),
                    child:
                        Text(auth.isGuest ? 'ورود / ثبت‌نام' : 'ثبت یک کار')),
              )),
          const SizedBox(height: 25),
          const AnimatedEntrance(
              delay: Duration(milliseconds: 180),
              child: SectionTitle(
                  title: 'شروع سریع',
                  subtitle: 'سه قدم برای وارد شدن به جریان کار')),
          const SizedBox(height: 12),
          const AnimatedEntrance(
              delay: Duration(milliseconds: 220),
              child: Row(children: [
                Expanded(
                    child: MetricTile(
                        icon: Icons.search_rounded,
                        label: '۱ • کشف',
                        value: 'پروژه‌های تازه')),
                SizedBox(width: 10),
                Expanded(
                    child: MetricTile(
                        icon: Icons.handshake_rounded,
                        label: '۲ • پیشنهاد',
                        value: 'یک همکاری حرفه‌ای'))
              ])),
          const SizedBox(height: 10),
          const MetricTile(
              icon: Icons.shield_outlined,
              label: '۳ • اعتماد',
              value: 'پرداخت و تحویل مرحله‌ای',
              color: AppColors.secondary),
          const SizedBox(height: 27),
          HopeSurface(
              padding: const EdgeInsets.all(18),
              highlight: true,
              child: Row(children: [
                const HopeIconTile(Icons.explore_rounded,
                    size: 50, filled: true),
                const SizedBox(width: 14),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text('آماده‌ای بازار را ببینی؟',
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text('چند دقیقه برای پیدا کردن فرصت مناسب کافی است.',
                          style: Theme.of(context).textTheme.bodyMedium)
                    ])),
                const SizedBox(width: 8),
                IconButton(
                    onPressed: () => context
                        .findAncestorStateOfType<_HomePageState>()
                        ?._selectTab(1),
                    icon: const Icon(Icons.arrow_back_rounded))
              ])),
        ]);
  }
}
