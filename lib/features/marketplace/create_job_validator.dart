class CreateJobValidationResult {
  const CreateJobValidationResult({this.error});
  final String? error;
  bool get isValid => error == null;
}

CreateJobValidationResult validateCreateJob({
  required String title,
  required String description,
  required String categoryId,
  required String minBudget,
  required String maxBudget,
  required String duration,
  required String acceptanceCriteria,
}) {
  final trimmedTitle = title.trim();
  if (trimmedTitle.isEmpty) {
    return const CreateJobValidationResult(error: 'عنوان کار را وارد کنید.');
  }
  // Mirrors the backend's textField(title, min:2, max:160) contract in
  // app.js -- catching this client-side avoids a round trip that would
  // otherwise fail with INVALID_FIELD after the user already submitted.
  if (trimmedTitle.length < 2 || trimmedTitle.length > 160) {
    return const CreateJobValidationResult(
      error: 'عنوان باید بین ۲ تا ۱۶۰ کاراکتر باشد.',
    );
  }
  if (description.trim().length < 10) {
    return const CreateJobValidationResult(
      error: 'شرح کار باید حداقل ۱۰ کاراکتر باشد.',
    );
  }
  if (categoryId.trim().isEmpty) {
    return const CreateJobValidationResult(
        error: 'شناسه دسته‌بندی را وارد کنید.');
  }

  final min = double.tryParse(minBudget.trim());
  final max = double.tryParse(maxBudget.trim());
  // Backend's moneyField() requires amount > 0 (strictly positive), not
  // just non-negative -- a budget of exactly 0 passes this check but is
  // rejected server-side with INVALID_AMOUNT. Match that here so the error
  // shows up immediately instead of after a failed submit.
  if (min == null || min <= 0) {
    return const CreateJobValidationResult(error: 'حداقل بودجه معتبر نیست.');
  }
  if (max == null || max <= 0) {
    return const CreateJobValidationResult(error: 'حداکثر بودجه معتبر نیست.');
  }
  if (min > max) {
    return const CreateJobValidationResult(
      error: 'حداقل بودجه نباید بیشتر از حداکثر بودجه باشد.',
    );
  }

  final hours = int.tryParse(duration.trim());
  // Backend also caps duration at 36500 (Number.isInteger(duration) &&
  // duration <= 36500 in app.js) -- add the same upper bound here.
  if (hours == null || hours <= 0 || hours > 36500) {
    return const CreateJobValidationResult(
      error: 'مدت انجام باید یک عدد صحیح بین ۱ تا ۳۶۵۰۰ باشد.',
    );
  }
  final trimmedCriteria = acceptanceCriteria.trim();
  // Backend requires acceptanceCriteria min length 2 (textField min:2).
  if (trimmedCriteria.length < 2) {
    return const CreateJobValidationResult(
      error: 'شرایط پذیرش کار را وارد کنید.',
    );
  }
  return const CreateJobValidationResult();
}
