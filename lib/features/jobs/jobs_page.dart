import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../../core/ui/components.dart';
import '../../theme/app_theme.dart';
import '../marketplace/job_detail_page.dart';

class JobsPage extends StatefulWidget {
  const JobsPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<JobsPage> createState() => _JobsPageState();
}

class _JobsPageState extends State<JobsPage> {
  late Future<dynamic> _future;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _future = widget.api.request('GET', '/jobs');
  }

  Future<void> _refresh() async {
    setState(() {
      _future = widget.api.request('GET', '/jobs');
    });

    try {
      await _future;
    } catch (_) {
      // The FutureBuilder displays the error state.
    }
  }

  List<Map<String, dynamic>> _normalizeJobs(dynamic raw) {
    final List<dynamic> source;

    if (raw is List) {
      source = raw;
    } else if (raw is Map && raw['data'] is List) {
      source = raw['data'] as List<dynamic>;
    } else {
      source = const <dynamic>[];
    }

    return source.whereType<Map>().map((item) {
      return Map<String, dynamic>.from(item);
    }).toList();
  }

  List<Map<String, dynamic>> _filterJobs(List<Map<String, dynamic>> jobs) {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) {
      return jobs;
    }

    return jobs.where((job) {
      final text = [
        job['title'],
        job['description'],
        job['city'],
      ].map((value) => value?.toString() ?? '').join(' ').toLowerCase();

      return text.contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: FutureBuilder<dynamic>(
        future: _future,
        builder: (context, snapshot) {
          final jobs = _filterJobs(_normalizeJobs(snapshot.data));

          return RefreshIndicator(
            onRefresh: _refresh,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 17, 20, 14),
                  sliver: SliverToBoxAdapter(
                    child: AnimatedEntrance(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'کشف کار',
                                      style: Theme.of(context)
                                          .textTheme
                                          .displaySmall,
                                    ),
                                    const SizedBox(height: 5),
                                    Text(
                                      'فرصتی را پیدا کن که ارزش وقتت را داشته باشد.',
                                      style:
                                          Theme.of(context).textTheme.bodyLarge,
                                    ),
                                  ],
                                ),
                              ),
                              const HopeIconTile(
                                Icons.explore_rounded,
                                size: 50,
                                filled: true,
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          SearchField(
                            onChanged: (value) {
                              setState(() {
                                _query = value;
                              });
                            },
                            hint: 'عنوان، شهر یا توضیحات...',
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              StatusPill(
                                '${jobs.length} فرصت',
                                color: AppColors.primary,
                                icon: Icons.bolt_rounded,
                              ),
                              const SizedBox(width: 7),
                              const StatusPill(
                                'به‌روز',
                                color: AppColors.success,
                                icon: Icons.refresh_rounded,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: CircularProgressIndicator(),
                    ),
                  )
                else if (snapshot.hasError)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: EmptyState(
                      icon: Icons.cloud_off_rounded,
                      title: 'اتصال برقرار نشد',
                      message: 'برای دریافت فرصت‌های کاری دوباره تلاش کن.',
                    ),
                  )
                else if (jobs.isEmpty)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: EmptyState(
                      icon: Icons.search_off_rounded,
                      title: 'چیزی پیدا نشد',
                      message:
                          'عبارت جست‌وجو را تغییر بده یا دوباره امتحان کن.',
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 122),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final job = jobs[index];

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 13),
                            child: _JobCard(
                              api: widget.api,
                              job: job,
                            ),
                          );
                        },
                        childCount: jobs.length,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _JobCard extends StatelessWidget {
  const _JobCard({required this.api, required this.job});

  final ApiClient api;
  final Map<String, dynamic> job;

  @override
  Widget build(BuildContext context) {
    final title = '${job['title'] ?? 'بدون عنوان'}';
    final description = '${job['description'] ?? ''}';
    final city = job['city'];
    final status = '${job['status'] ?? 'PUBLISHED'}';
    final minBudget = job['budgetMin']?.toString() ?? '—';
    final maxBudget = job['budgetMax']?.toString() ?? '—';

    return PressableScale(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => JobDetailPage(
              api: api,
              job: job,
            ),
          ),
        );
      },
      semanticLabel: 'جزئیات $title',
      child: HopeSurface(
        highlight: true,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const HopeIconTile(
                    Icons.work_rounded,
                    size: 48,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          city?.toString().trim().isNotEmpty == true
                              ? '$city'
                              : 'فرصت آنلاین',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.arrow_back_ios_new_rounded,
                    size: 15,
                  ),
                ],
              ),
              if (description.trim().isNotEmpty) ...[
                const SizedBox(height: 13),
                Text(
                  description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
              const SizedBox(height: 15),
              Wrap(
                spacing: 7,
                runSpacing: 7,
                children: [
                  StatusPill(
                    status == 'PUBLISHED' ? 'منتشر شده' : status,
                    color: AppColors.success,
                    icon: Icons.check_circle_outline_rounded,
                  ),
                  StatusPill(
                    '$minBudget تا $maxBudget',
                    icon: Icons.payments_outlined,
                  ),
                  if (job['duration'] != null)
                    StatusPill(
                      '${job['duration']} ساعت',
                      color: AppColors.secondary,
                      icon: Icons.schedule_rounded,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
