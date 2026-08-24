import 'package:flutter_test/flutter_test.dart';
import 'package:hope_mobile/features/marketplace/create_job_validator.dart';

void main() {
  const base = <String, String>{
    'title': 'طراحی سایت',
    'description': 'شرح کامل این کار برای تست اعتبارسنجی.',
    'categoryId': 'cat-1',
    'minBudget': '100',
    'maxBudget': '500',
    'duration': '8',
    'acceptanceCriteria': 'تحویل کامل و مطابق شرح.',
  };

  test('accepts valid input', () {
    final result = validateCreateJob(
      title: base['title']!,
      description: base['description']!,
      categoryId: base['categoryId']!,
      minBudget: base['minBudget']!,
      maxBudget: base['maxBudget']!,
      duration: base['duration']!,
      acceptanceCriteria: base['acceptanceCriteria']!,
    );
    expect(result.isValid, isTrue);
  });

  test('rejects reversed budget range', () {
    final result = validateCreateJob(
      title: base['title']!,
      description: base['description']!,
      categoryId: base['categoryId']!,
      minBudget: '900',
      maxBudget: '500',
      duration: base['duration']!,
      acceptanceCriteria: base['acceptanceCriteria']!,
    );
    expect(result.error, contains('حداقل بودجه'));
  });

  test('rejects invalid duration', () {
    final result = validateCreateJob(
      title: base['title']!,
      description: base['description']!,
      categoryId: base['categoryId']!,
      minBudget: base['minBudget']!,
      maxBudget: base['maxBudget']!,
      duration: '0',
      acceptanceCriteria: base['acceptanceCriteria']!,
    );
    expect(result.isValid, isFalse);
  });
}
