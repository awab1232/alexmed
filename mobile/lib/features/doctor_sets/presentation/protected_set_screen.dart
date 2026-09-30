import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../core/api/api_error.dart';
import '../../../core/ui/secure_screen.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../question_files/domain/question_rules.dart';
import '../../question_files/presentation/question_deck_view.dart';
import '../data/doctor_set_models.dart';
import '../data/doctor_sets_repository.dart';

/// A protected set, opened — the web's app/question-sets/[setId]: the same
/// question cards as any question file, with the viewer's watermark.
///
/// Memory only (blueprint §14): the questions live in this screen's state,
/// never in a provider cache or on disk; answers too; images are fetched
/// without caching. Access is re-checked on every open and whenever the app
/// returns to the foreground (the web refetches on window focus) — a
/// revoked, disabled or expired set closes into «غير متاحة». Screenshots
/// are blocked on Android while it is open (FLAG_SECURE, D7 default).
class ProtectedSetScreen extends ConsumerStatefulWidget {
  const ProtectedSetScreen({super.key, required this.setId});

  final String setId;

  @override
  ConsumerState<ProtectedSetScreen> createState() => _ProtectedSetScreenState();
}

class _ProtectedSetScreenState extends ConsumerState<ProtectedSetScreen>
    with WidgetsBindingObserver {
  ProtectedSet? _set;
  Object? _error;
  bool _loading = true;
  final _answers = <String, CardAnswer>{};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _set != null) _load();
  }

  Future<void> _load() async {
    try {
      final set = await ref
          .read(doctorSetsRepositoryProvider)
          .open(widget.setId);
      if (!mounted) return;
      setState(() {
        _set = set;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        // Access ended while open: drop what was shown.
        if (error is NotFoundException || error is ForbiddenException) {
          _set = null;
          _answers.clear();
        }
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final set = _set;
    return SecureScreen(
      child: Scaffold(
        appBar: AppBar(
          title: Text(set == null ? l10n.doctorSetsTitle : isolate(set.title)),
        ),
        body: _loading
            ? const Padding(
                padding: EdgeInsets.all(NlSpace.page),
                child: NlListSkeleton(),
              )
            : set == null
            ? _error is NotFoundException || _error is ForbiddenException
                  ? NlEmptyState(
                      expression: NiroExpression.sleepy,
                      title: l10n.dsSetUnavailable,
                      actionLabel: l10n.doctorSetsTitle,
                      onAction: () => context.canPop()
                          ? context.pop()
                          : context.go(Routes.questionSets),
                    )
                  : NlErrorView(error: _error!, onRetry: _load)
            : Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      NlSpace.page,
                      0,
                      NlSpace.page,
                      NlSpace.xs,
                    ),
                    child: Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Text(
                        [
                              set.doctorName,
                              set.subjectLabel,
                              l10n.qfCount(set.questions.length),
                            ]
                            .whereType<String>()
                            .where((s) => s.isNotEmpty)
                            .join(' · '),
                        style: NlText.caption,
                      ),
                    ),
                  ),
                  Expanded(
                    child: set.questions.isEmpty
                        ? NlEmptyState(title: l10n.qfNoQuestions)
                        : QuestionDeckView(
                            questions: set.questions,
                            answers: _answers,
                            watermark: set.watermark,
                            imagesCached: false,
                            onAnswer: (id, a) =>
                                setState(() => _answers[id] = a),
                          ),
                  ),
                ],
              ),
      ),
    );
  }
}
