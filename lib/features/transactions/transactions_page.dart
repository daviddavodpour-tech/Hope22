import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/network/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/ui/components.dart';
import '../../theme/app_theme.dart';
import '../auth/login_page.dart';

class TransactionsPage extends StatefulWidget {
  const TransactionsPage({super.key, required this.api});
  final ApiClient api;
  @override
  State<TransactionsPage> createState() => _TransactionsPageState();
}

class _TransactionsPageState extends State<TransactionsPage> {
  Future<dynamic>? future;
  String? loadedUserId;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final id = context.read<AuthController>().user?['id']?.toString();
    if (id != loadedUserId) {
      loadedUserId = id;
      future = id == null
          ? null
          : widget.api.request('GET', '/jobs/mine', auth: true);
    }
  }

  Future<void> reload() async {
    setState(
        () => future = widget.api.request('GET', '/jobs/mine', auth: true));
    await future?.catchError((_) => null);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    if (auth.isGuest) {
      return Center(
          child: EmptyState(
              icon: Icons.lock_outline_rounded,
              title: 'فضای فعالیت خصوصی است',
              message: 'برای دیدن پروژه‌ها و پرداخت‌ها وارد حساب شو.',
              action: FilledButton.icon(
                  onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => LoginPage(api: widget.api))),
                  icon: const Icon(Icons.login_rounded),
                  label: const Text('ورود'))));
    }
    if (future == null) return const Center(child: CircularProgressIndicator());
    return FutureBuilder<dynamic>(
        future: future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return RefreshIndicator(
                onRefresh: reload,
                child: ListView(children: const [
                  SizedBox(height: 220),
                  EmptyState(
                      icon: Icons.cloud_off_rounded,
                      title: 'دریافت فعالیت ناموفق بود',
                      message: 'برای تلاش دوباره صفحه را پایین بکش.')
                ]));
          }
          final items = snap.data is List
              ? (snap.data as List).whereType<Map>().toList()
              : <Map>[];
          if (items.isEmpty) {
            return RefreshIndicator(
                onRefresh: reload,
                child: ListView(children: const [
                  SizedBox(height: 220),
                  EmptyState(
                      icon: Icons.auto_graph_rounded,
                      title: 'هنوز فعالیتی نیست',
                      message:
                          'با ارسال یا قبول پیشنهاد، جریان کار تو اینجا دیده می‌شود.')
                ]));
          }
          return RefreshIndicator(
              onRefresh: reload,
              child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 17, 20, 122),
                  children: [
                    Row(children: [
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text('فعالیت',
                                style:
                                    Theme.of(context).textTheme.displaySmall),
                            const SizedBox(height: 5),
                            Text('پروژه‌ها، وضعیت و پرداخت‌ها در یک نگاه.',
                                style: Theme.of(context).textTheme.bodyLarge)
                          ])),
                      const HopeIconTile(Icons.swap_horizontal_circle_rounded,
                          size: 50, filled: true)
                    ]),
                    const SizedBox(height: 18),
                    Row(children: [
                      Expanded(
                          child: MetricTile(
                              label: 'کل پروژه‌ها',
                              value: '${items.length}',
                              icon: Icons.work_history_rounded)),
                      const SizedBox(width: 10),
                      const Expanded(
                          child: MetricTile(
                              label: 'وضعیت',
                              value: 'زنده',
                              icon: Icons.bolt_rounded,
                              color: AppColors.secondary))
                    ]),
                    const SizedBox(height: 20),
                    const SectionTitle(
                        title: 'آخرین فعالیت‌ها',
                        subtitle: 'جدیدترین وضعیت پروژه‌ها'),
                    const SizedBox(height: 12),
                    ...items.map((job) {
                      final tx = job['transaction'] as Map?;
                      final status = '${tx?['status'] ?? job['status'] ?? '—'}';
                      final released =
                          status == 'RELEASED' || status == 'COMPLETED';
                      return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: HopeSurface(
                              padding: const EdgeInsets.all(17),
                              child: Row(children: [
                                HopeIconTile(
                                    released
                                        ? Icons.check_rounded
                                        : Icons.hourglass_top_rounded,
                                    color: released
                                        ? AppColors.success
                                        : AppColors.primary,
                                    filled: true),
                                const SizedBox(width: 12),
                                Expanded(
                                    child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                      Text('${job['title'] ?? ''}',
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleMedium),
                                      const SizedBox(height: 5),
                                      Text('وضعیت کار: ${job['status'] ?? '—'}',
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodyMedium)
                                    ])),
                                const SizedBox(width: 7),
                                StatusPill(released ? 'تمام شد' : 'در جریان',
                                    color: released
                                        ? AppColors.success
                                        : AppColors.primary)
                              ])));
                    }),
                  ]));
        });
  }
}
