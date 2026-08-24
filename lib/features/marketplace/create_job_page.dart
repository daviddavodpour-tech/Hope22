import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import '../../core/ui/components.dart';
import 'create_job_validator.dart';

class CreateJobPage extends StatefulWidget {
  const CreateJobPage({super.key, required this.api});
  final ApiClient api;
  @override
  State<CreateJobPage> createState() => _CreateJobPageState();
}

class _CreateJobPageState extends State<CreateJobPage> {
  final title = TextEditingController();
  final desc = TextEditingController();
  final cat = TextEditingController();
  final min = TextEditingController();
  final max = TextEditingController();
  final duration = TextEditingController(text: '1');
  final accept = TextEditingController(text: 'کار مطابق شرح انجام شود');
  bool busy = false;
  @override
  void dispose() {
    for (final c in [title, desc, cat, min, max, duration, accept]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    final validation = validateCreateJob(
        title: title.text,
        description: desc.text,
        categoryId: cat.text,
        minBudget: min.text,
        maxBudget: max.text,
        duration: duration.text,
        acceptanceCriteria: accept.text);
    if (!validation.isValid) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(validation.error!)));
      return;
    }
    setState(() => busy = true);
    try {
      final data = await widget.api.request('POST', '/jobs', auth: true, body: {
        'title': title.text.trim(),
        'description': desc.text.trim(),
        'categoryId': cat.text.trim(),
        'jobType': 'FIXED',
        'budgetType': 'FIXED',
        'budgetMin': double.parse(min.text.trim()),
        'budgetMax': double.parse(max.text.trim()),
        'duration': int.parse(duration.text.trim()),
        'acceptanceCriteria': accept.text.trim()
      });
      final id = data is Map ? data['id'] : null;
      if (id == null || id.toString().isEmpty)
        throw const FormatException(
            'Create job response did not contain an id');
      await widget.api.request('POST', '/jobs/$id/publish', auth: true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('کار با موفقیت منتشر شد.')));
        Navigator.pop(context);
      }
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(
                error.toString().replaceFirst(RegExp(r'^[^:]+:\s*'), ''))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          appBar: AppBar(
              title: const Text('ثبت یک کار'),
              leading: IconButton(
                  onPressed: () => Navigator.maybePop(context),
                  icon: const Icon(Icons.arrow_forward_rounded))),
          body: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
              children: [
                const GradientHero(
                    eyebrow: 'ایجاد فرصت',
                    title: 'شرح خوب، همکاری بهتر.',
                    message:
                        'در چند مرحله پروژه‌ات را واضح تعریف کن تا افراد مناسب راحت‌تر تصمیم بگیرند.',
                    icon: Icons.add_business_rounded),
                const SizedBox(height: 22),
                const SectionTitle(
                    title: 'اطلاعات اصلی', subtitle: 'واضح و دقیق بنویس'),
                const SizedBox(height: 12),
                HopeSurface(
                    padding: const EdgeInsets.all(16),
                    child: Column(children: [
                      TextField(
                          controller: title,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                              labelText: 'عنوان کار',
                              prefixIcon: Icon(Icons.title_rounded))),
                      const SizedBox(height: 12),
                      TextField(
                          controller: desc,
                          maxLines: 5,
                          decoration: const InputDecoration(
                              labelText: 'شرح کار',
                              alignLabelWithHint: true,
                              prefixIcon: Icon(Icons.notes_rounded))),
                      const SizedBox(height: 12),
                      TextField(
                          controller: cat,
                          decoration: const InputDecoration(
                              labelText: 'شناسه دسته‌بندی',
                              prefixIcon: Icon(Icons.category_outlined))),
                    ])),
                const SizedBox(height: 20),
                const SectionTitle(
                    title: 'بودجه و زمان', subtitle: 'انتظارات را شفاف کن'),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                      child: TextField(
                          controller: min,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                              labelText: 'حداقل بودجه',
                              prefixIcon: Icon(Icons.payments_outlined)))),
                  const SizedBox(width: 10),
                  Expanded(
                      child: TextField(
                          controller: max,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                              labelText: 'حداکثر بودجه',
                              prefixIcon:
                                  Icon(Icons.account_balance_wallet_outlined))))
                ]),
                const SizedBox(height: 12),
                TextField(
                    controller: duration,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'مدت (ساعت)',
                        prefixIcon: Icon(Icons.schedule_rounded))),
                const SizedBox(height: 20),
                const SectionTitle(
                    title: 'معیار پذیرش', subtitle: 'تحویل موفق یعنی چه؟'),
                const SizedBox(height: 12),
                TextField(
                    controller: accept,
                    maxLines: 3,
                    decoration: const InputDecoration(
                        labelText: 'شرایط پذیرش',
                        alignLabelWithHint: true,
                        prefixIcon: Icon(Icons.fact_check_outlined))),
                const SizedBox(height: 24),
                FilledButton.icon(
                    onPressed: busy ? null : submit,
                    icon: const Icon(Icons.rocket_launch_rounded),
                    label: busy
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('انتشار کار')),
                const SizedBox(height: 8),
                Text('قبل از انتشار، اطلاعات و بودجه را یک بار بررسی کن.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium),
              ]),
        ),
      );
}
