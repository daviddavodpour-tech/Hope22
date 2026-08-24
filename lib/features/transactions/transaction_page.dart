import 'package:flutter/material.dart';
import 'dart:io';
import '../evidence/evidence_picker.dart';
import '../../core/uploads/upload_queue.dart';
import '../../core/network/api_client.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/components.dart';
import '../../theme/app_theme.dart';

class TransactionPage extends StatefulWidget {
  const TransactionPage({super.key, required this.api, required this.jobId});
  final ApiClient api;
  final String jobId;
  @override
  State<TransactionPage> createState() => _TransactionPageState();
}

class _TransactionPageState extends State<TransactionPage> {
  Map<String, dynamic>? tx;
  bool loading = true;
  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    try {
      final data = await widget.api
          .request('GET', '/payments/jobs/${widget.jobId}', auth: true);
      if (mounted) setState(() => tx = Map<String, dynamic>.from(data));
    } catch (_) {
      // Keep the previous transaction view visible while exposing the error
      // through the loading state rather than throwing during teardown.
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> action(String path, {Map<String, dynamic>? body}) async {
    setState(() => loading = true);
    try {
      await widget.api.request('POST', path, auth: true, body: body);
      await refresh();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('عملیات انجام شد.')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('عملیات انجام نشد.')));
      }
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading && tx == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final status = tx?['status'] ?? 'NO_TRANSACTION';
    final job =
        tx?['job'] is Map ? Map<String, dynamic>.from(tx!['job'] as Map) : null;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
            leading: IconButton(
                onPressed: () => Navigator.maybePop(context),
                icon: const Icon(Icons.arrow_forward_rounded)),
            title: const Text('معامله')),
        body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
            children: [
              Row(children: [
                const HopeMark(size: 38),
                const Spacer(),
                StatusPill(
                    status == 'NO_TRANSACTION' ? 'بدون پرداخت' : '$status',
                    color: status == 'RELEASED'
                        ? AppColors.success
                        : AppColors.primary)
              ]),
              const SizedBox(height: 20),
              if (job != null)
                Text('${job['title'] ?? 'جزئیات معامله'}',
                    style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 14),
              HopeSurface(
                  padding: const EdgeInsets.all(18),
                  child: Column(children: [
                    Row(children: [
                      Expanded(
                          child: Text('وضعیت پرداخت',
                              style: Theme.of(context).textTheme.bodyMedium)),
                      Text('$status',
                          style: Theme.of(context).textTheme.titleMedium)
                    ]),
                    const SizedBox(height: 14),
                    Row(children: [
                      Expanded(
                          child: Text('مبلغ',
                              style: Theme.of(context).textTheme.bodyMedium)),
                      Text('${tx?['amount'] ?? '-'}',
                          style: Theme.of(context).textTheme.titleMedium)
                    ]),
                    const SizedBox(height: 14),
                    Row(children: [
                      Expanded(
                          child: Text('مرجع',
                              style: Theme.of(context).textTheme.bodyMedium)),
                      Flexible(
                          child: Text('${tx?['providerRef'] ?? '—'}',
                              textAlign: TextAlign.left,
                              style: Theme.of(context).textTheme.titleMedium))
                    ]),
                  ])),
              const SizedBox(height: 14),
              if (status == 'NO_TRANSACTION')
                FilledButton.icon(
                    onPressed: loading
                        ? null
                        : () => action('/payments/fund/${widget.jobId}', body: {
                              'idempotencyKey':
                                  'mobile-${DateTime.now().millisecondsSinceEpoch}'
                            }),
                    icon: const Icon(Icons.account_balance_wallet_rounded),
                    label: const Text('تأمین بودجه')),
              if (job != null)
                EvidenceActions(
                    api: widget.api,
                    jobId: widget.jobId,
                    job: {
                      ...job,
                      'paymentStatus': tx?['paymentStatus'] ?? tx?['status']
                    },
                    onChanged: refresh),
            ]),
      ),
    );
  }
}

class EvidenceActions extends StatefulWidget {
  const EvidenceActions(
      {super.key,
      required this.api,
      required this.jobId,
      required this.job,
      required this.onChanged});
  final ApiClient api;
  final String jobId;
  final Map<String, dynamic> job;
  final VoidCallback onChanged;
  @override
  State<EvidenceActions> createState() => _EvidenceActionsState();
}

class _EvidenceActionsState extends State<EvidenceActions> {
  bool busy = false;
  Future<void> post(String path, {Map<String, dynamic>? body}) async {
    setState(() => busy = true);
    try {
      await widget.api.request('POST', path, auth: true, body: body);
      widget.onChanged();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('عملیات انجام نشد.')));
      }
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final st = '${widget.job['status'] ?? ''}';
    final paymentStatus = '${widget.job['paymentStatus'] ?? ''}';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Divider(height: 32),
      Text('اجرای کار', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 12),
      if (st == 'FUNDED')
        FilledButton(
            onPressed: busy ? null : () => post('/jobs/${widget.jobId}/start'),
            child: const Text('شروع کار')),
      if (st == 'IN_PROGRESS') ...[
        OutlinedButton(
            onPressed: busy
                ? null
                : () => showDialog(
                    context: context,
                    builder: (_) => EvidenceDialog(
                        api: widget.api,
                        jobId: widget.jobId,
                        onDone: widget.onChanged)),
            child: const Text('ثبت Evidence')),
        FilledButton(
            onPressed:
                busy ? null : () => post('/jobs/${widget.jobId}/deliver'),
            child: const Text('تحویل کار'))
      ],
      if (st == 'DELIVERED' || st == 'UNDER_REVIEW')
        FilledButton(
            onPressed: busy ? null : () => post('/jobs/${widget.jobId}/accept'),
            child: const Text('تأیید تحویل')),
      if (st == 'COMPLETED' && paymentStatus == 'RELEASE_PENDING')
        FilledButton(
            onPressed:
                busy ? null : () => post('/payments/release/${widget.jobId}'),
            child: const Text('تسویه')),
      if (st == 'COMPLETED' && paymentStatus == 'RELEASED')
        const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('وجه تسویه شده است.')),
      if (st == 'SETTLED')
        const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('معامله تسویه شده است.'))
    ]);
  }
}

class EvidenceDialog extends StatefulWidget {
  const EvidenceDialog(
      {super.key,
      required this.api,
      required this.jobId,
      required this.onDone});
  final ApiClient api;
  final String jobId;
  final VoidCallback onDone;
  @override
  State<EvidenceDialog> createState() => _EvidenceDialogState();
}

class _EvidenceDialogState extends State<EvidenceDialog> {
  final uri = TextEditingController();
  final notes = TextEditingController();
  bool busy = false;
  File? file;
  late final UploadQueue queue;
  @override
  void initState() {
    super.initState();
    queue = UploadQueue(widget.api);
  }

  @override
  void dispose() {
    uri.dispose();
    notes.dispose();
    super.dispose();
  }

  Future<void> pick() async {
    final selected = await EvidencePicker().pickFile();
    if (mounted && selected != null) setState(() => file = selected);
  }

  Future<void> send() async {
    setState(() => busy = true);
    try {
      String evidenceUri = uri.text.trim();
      if (file != null) {
        // Retry with backoff via the upload queue instead of a single
        // direct attempt, so a flaky connection doesn't force the user
        // to re-pick the file and resubmit from scratch.
        final uploaded =
            await queue.uploadNowWithRetry('/storage/upload', file!);
        if (uploaded is Map && uploaded['key'] is String) {
          evidenceUri = 'storage://${uploaded['key']}';
        }
      }
      if (evidenceUri.isEmpty) {
        throw StateError('Evidence file or URI is required');
      }
      await widget.api
          .request('POST', '/jobs/${widget.jobId}/evidence', auth: true, body: {
        'uri': evidenceUri,
        'notes': notes.text.trim(),
        'type': file != null ? 'FILE' : 'DELIVERY_LINK'
      });
      if (mounted) {
        Navigator.pop(context);
        widget.onDone();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('ثبت Evidence انجام نشد.')));
      }
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
          title: const Row(children: [
            HopeIconTile(Icons.upload_file_rounded, size: 42),
            SizedBox(width: 10),
            Expanded(child: Text('ثبت Evidence'))
          ]),
          content: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
            OutlinedButton.icon(
                onPressed: busy ? null : pick,
                icon: const Icon(Icons.attach_file),
                label: Text(
                    file == null ? 'انتخاب فایل' : file!.path.split('/').last)),
            TextField(
                controller: uri,
                decoration:
                    const InputDecoration(labelText: 'لینک/URI (اختیاری)')),
            TextField(
                controller: notes,
                decoration: const InputDecoration(labelText: 'توضیحات'))
          ])),
          actions: [
            TextButton(
                onPressed: busy ? null : () => Navigator.pop(context),
                child: const Text('انصراف')),
            FilledButton(
                onPressed: busy ? null : send, child: const Text('ثبت'))
          ]);
}
