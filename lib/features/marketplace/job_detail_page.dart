import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/network/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/ui/components.dart';
import '../../theme/app_theme.dart';
import '../auth/login_page.dart';
import '../transactions/transaction_page.dart';

class JobDetailPage extends StatefulWidget {
  const JobDetailPage({super.key, required this.api, required this.job});
  final ApiClient api;
  final Map<String, dynamic> job;
  @override
  State<JobDetailPage> createState() => _JobDetailPageState();
}

class _JobDetailPageState extends State<JobDetailPage> {
  bool loading = false;
  Future<void> offer() async {
    if (!context.read<AuthController>().isAuthenticated) {
      await Navigator.push(context,
          MaterialPageRoute(builder: (_) => LoginPage(api: widget.api)));
      if (!mounted || !context.read<AuthController>().isAuthenticated) return;
    }
    final price =
        TextEditingController(text: '${widget.job['budgetMin'] ?? ''}');
    final message = TextEditingController();
    final result = await showModalBottomSheet<List<String>>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => Directionality(
            textDirection: TextDirection.rtl,
            child: Padding(
                padding: EdgeInsets.fromLTRB(
                    20, 8, 20, MediaQuery.of(context).viewInsets.bottom + 24),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('پیشنهاد انجام کار',
                          style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 7),
                      Text('قیمت و یک پیام کوتاه برای کارفرما بفرست.',
                          style: Theme.of(context).textTheme.bodyMedium),
                      const SizedBox(height: 18),
                      TextField(
                          controller: price,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                              labelText: 'قیمت پیشنهادی',
                              prefixIcon: Icon(Icons.payments_outlined))),
                      const SizedBox(height: 12),
                      TextField(
                          controller: message,
                          maxLines: 4,
                          decoration: const InputDecoration(
                              labelText: 'پیام برای کارفرما',
                              alignLabelWithHint: true,
                              prefixIcon:
                                  Icon(Icons.chat_bubble_outline_rounded))),
                      const SizedBox(height: 18),
                      FilledButton(
                          onPressed: () => Navigator.pop(
                              context, [price.text, message.text]),
                          child: const Text('ارسال پیشنهاد')),
                    ]))));
    price.dispose();
    message.dispose();
    if (result == null || !mounted) return;
    setState(() => loading = true);
    try {
      await widget.api.request('POST', '/offers', auth: true, body: {
        'jobId': widget.job['id'],
        'price': double.tryParse(result[0]) ?? 0,
        'message': result[1]
      });
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('پیشنهاد ثبت شد.')));
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('ثبت پیشنهاد انجام نشد.')));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final j = widget.job;
    return Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          appBar: AppBar(
              leading: IconButton(
                  onPressed: () => Navigator.maybePop(context),
                  icon: const Icon(Icons.arrow_forward_rounded)),
              title: const Text('جزئیات فرصت')),
          bottomNavigationBar: SafeArea(
              child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 18),
                  child: FilledButton.icon(
                      onPressed: loading ? null : offer,
                      icon: const Icon(Icons.send_rounded),
                      label: Text(loading
                          ? 'در حال ارسال…'
                          : 'می‌خواهم پیشنهاد بدهم')))),
          body: ListView(
              padding: const EdgeInsets.fromLTRB(20, 5, 20, 20),
              children: [
                HopeSurface(
                    highlight: true,
                    padding: const EdgeInsets.all(21),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            const HopeIconTile(Icons.work_rounded,
                                size: 56, filled: true),
                            const SizedBox(width: 13),
                            Expanded(
                                child: Text('${j['title'] ?? ''}',
                                    style: Theme.of(context)
                                        .textTheme
                                        .headlineSmall))
                          ]),
                          const SizedBox(height: 17),
                          Wrap(spacing: 7, runSpacing: 7, children: [
                            StatusPill('${j['status'] ?? '—'}',
                                color: AppColors.success, icon: Icons.circle),
                            if (j['city'] != null)
                              StatusPill('${j['city']}',
                                  color: AppColors.muted,
                                  icon: Icons.location_on_outlined),
                            StatusPill('${j['duration'] ?? '—'} ساعت',
                                color: AppColors.secondary,
                                icon: Icons.schedule_rounded)
                          ]),
                          const SizedBox(height: 18),
                          Text('${j['description'] ?? ''}',
                              style: Theme.of(context).textTheme.bodyLarge),
                        ])),
                const SizedBox(height: 13),
                Row(children: [
                  Expanded(
                      child: MetricTile(
                          label: 'بودجه',
                          value:
                              '${j['budgetMin'] ?? '—'} تا ${j['budgetMax'] ?? '—'}',
                          icon: Icons.payments_outlined)),
                  const SizedBox(width: 10),
                  Expanded(
                      child: MetricTile(
                          label: 'نوع همکاری',
                          value: '${j['jobType'] ?? 'FIXED'}',
                          icon: Icons.tune_rounded,
                          color: AppColors.secondary))
                ]),
                const SizedBox(height: 13),
                HopeSurface(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            const HopeIconTile(Icons.fact_check_outlined,
                                size: 42),
                            const SizedBox(width: 10),
                            Text('معیار پذیرش',
                                style: Theme.of(context).textTheme.titleMedium)
                          ]),
                          const SizedBox(height: 12),
                          Text(
                              '${j['acceptanceCriteria'] ?? 'بر اساس شرح کار و توافق طرفین.'}',
                              style: Theme.of(context).textTheme.bodyMedium)
                        ])),
                const SizedBox(height: 13),
                OutlinedButton.icon(
                    onPressed: () {
                      if (!context.read<AuthController>().isAuthenticated) {
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => LoginPage(api: widget.api)));
                        return;
                      }
                      Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => TransactionPage(
                                  api: widget.api, jobId: '${j['id']}')));
                    },
                    icon: const Icon(Icons.receipt_long_rounded),
                    label: const Text('مشاهده وضعیت معامله')),
              ]),
        ));
  }
}
