import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/components.dart';

class PasswordResetPage extends StatefulWidget {
  const PasswordResetPage({super.key, required this.api});
  final ApiClient api;
  @override
  State<PasswordResetPage> createState() => _PasswordResetPageState();
}

class _PasswordResetPageState extends State<PasswordResetPage> {
  final email = TextEditingController();
  bool loading = false;
  @override
  void dispose() {
    email.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (email.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('ایمیل را وارد کن.')));
      return;
    }
    setState(() => loading = true);
    try {
      await widget.api.request('POST', '/auth/password-reset/request',
          body: {'email': email.text.trim()});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content:
                Text('اگر حساب وجود داشته باشد، درخواست بازیابی ثبت شد.')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('ثبت درخواست بازیابی انجام نشد.')));
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          body: SafeArea(
              child: ListView(
                  padding: const EdgeInsets.fromLTRB(22, 22, 22, 30),
                  children: [
                Row(children: [
                  IconButton(
                      onPressed: () => Navigator.maybePop(context),
                      icon: const Icon(Icons.arrow_forward_rounded)),
                  const Spacer(),
                  const HopeMark(size: 40)
                ]),
                const SizedBox(height: 34),
                const HopeIconTile(Icons.mark_email_unread_outlined, size: 60),
                const SizedBox(height: 20),
                Text('بازیابی رمز عبور',
                    style: Theme.of(context).textTheme.displaySmall),
                const SizedBox(height: 8),
                Text(
                    'ایمیل حساب را وارد کن؛ راهنمای بازیابی برایت ارسال می‌شود.',
                    style: Theme.of(context).textTheme.bodyLarge),
                const SizedBox(height: 24),
                HopeSurface(
                    padding: const EdgeInsets.all(18),
                    child: Column(children: [
                      TextField(
                          controller: email,
                          keyboardType: TextInputType.emailAddress,
                          textDirection: TextDirection.ltr,
                          decoration: const InputDecoration(
                              labelText: 'ایمیل',
                              prefixIcon: Icon(Icons.mail_outline_rounded))),
                      const SizedBox(height: 14),
                      FilledButton(
                          onPressed: loading ? null : submit,
                          child: loading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2))
                              : const Text('ارسال درخواست')),
                    ])),
                const SizedBox(height: 16),
                const EmptyState(
                    icon: Icons.shield_outlined,
                    title: 'نگران نباش',
                    message:
                        'برای حفظ امنیت، حتی در صورت نبودن حساب هم پاسخ مشابهی دریافت می‌کنی.'),
              ])),
        ),
      );
}
