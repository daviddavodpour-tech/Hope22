import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/network/api_client.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/components.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key, required this.api});
  final ApiClient api;
  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  bool obscure = true;
  bool loading = false;

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (name.text.trim().isEmpty ||
        email.text.trim().isEmpty ||
        password.text.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('همه فیلدها را پر کن.')));
      return;
    }
    if (password.text.length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('رمز عبور باید حداقل ۸ کاراکتر باشد.')));
      return;
    }
    setState(() => loading = true);
    try {
      await context
          .read<AuthController>()
          .register(email.text.trim(), password.text, name.text.trim());
      if (mounted && Navigator.of(context).canPop())
        Navigator.of(context).pop();
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(context.read<AuthController>().error ??
                'ثبت‌نام انجام نشد. دوباره تلاش کن.')));
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
                const SizedBox(height: 32),
                const HopeIconTile(Icons.person_add_alt_1_rounded, size: 60),
                const SizedBox(height: 18),
                Text('شروع یک همکاری خوب.',
                    style: Theme.of(context).textTheme.displaySmall),
                const SizedBox(height: 8),
                Text('یک حساب HOPE بساز و قدم اول را بردار.',
                    style: Theme.of(context).textTheme.bodyLarge),
                const SizedBox(height: 24),
                HopeSurface(
                    padding: const EdgeInsets.all(18),
                    child: Column(children: [
                      TextField(
                          controller: name,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                              labelText: 'نام و نام خانوادگی',
                              prefixIcon: Icon(Icons.person_outline_rounded))),
                      const SizedBox(height: 12),
                      TextField(
                          controller: email,
                          keyboardType: TextInputType.emailAddress,
                          textDirection: TextDirection.ltr,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                              labelText: 'ایمیل',
                              prefixIcon: Icon(Icons.mail_outline_rounded))),
                      const SizedBox(height: 12),
                      TextField(
                          controller: password,
                          obscureText: obscure,
                          textDirection: TextDirection.ltr,
                          decoration: InputDecoration(
                              labelText: 'رمز عبور',
                              prefixIcon:
                                  const Icon(Icons.lock_outline_rounded),
                              suffixIcon: IconButton(
                                  icon: Icon(obscure
                                      ? Icons.visibility_off_rounded
                                      : Icons.visibility_rounded),
                                  onPressed: () =>
                                      setState(() => obscure = !obscure)))),
                      const SizedBox(height: 8),
                      Align(
                          alignment: Alignment.centerRight,
                          child: Text('حداقل ۸ کاراکتر',
                              style: Theme.of(context).textTheme.bodyMedium)),
                      const SizedBox(height: 15),
                      FilledButton(
                          onPressed: loading ? null : submit,
                          child: loading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2))
                              : const Text('ساخت حساب')),
                    ])),
                const SizedBox(height: 14),
                Text(
                    'با ساخت حساب، اطلاعات تو در فضای امن HOPE نگهداری می‌شود.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ),
      );
}
