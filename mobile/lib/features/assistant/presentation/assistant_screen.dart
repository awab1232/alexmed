import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_error.dart';
import '../../../core/ui/rich_text.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../account/data/account_repository.dart';
import '../../library/data/library_repository.dart';
import '../data/assistant_repository.dart';
import '../data/photo_prep.dart';
import '../domain/niro_turn.dart';

enum _Status { idle, waiting, streaming }

/// Niro — the web's app/assistant: an open assistant for any question or a
/// photo (camera or gallery), answers streamed as they are written, stop,
/// copy, new chat, and the conversation kept on this device. On failure the
/// question and photo come back to the input so a retry is one tap; a plan
/// limit is explained, never sold (no purchase UI).
class AssistantScreen extends ConsumerStatefulWidget {
  const AssistantScreen({super.key});

  @override
  ConsumerState<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends ConsumerState<AssistantScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  List<NiroTurn> _turns = const [];
  PreparedPhoto? _attachment;
  bool _preparing = false;
  _Status _status = _Status.idle;
  String? _error;
  PlanLimitDetails? _limit;
  CancelToken? _cancel;
  StreamSubscription<String>? _sub;
  int? _copied;
  bool _loaded = false;

  AssistantRepository get _repo => ref.read(assistantRepositoryProvider);
  bool get _busy => _status != _Status.idle;

  @override
  void initState() {
    super.initState();
    _input.addListener(() => setState(() {}));
    _repo.loadHistory().then((turns) {
      if (!mounted) return;
      setState(() {
        // A message sent before the saved history arrived stays after it.
        _turns = [...turns, ..._turns];
        _loaded = true;
      });
      _toEnd();
    });
  }

  @override
  void dispose() {
    _cancel?.cancel();
    _sub?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _toEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  void _save() {
    if (_loaded) unawaited(_repo.saveHistory(_turns));
  }

  Future<void> _pick(PhotoSource source) async {
    if (_busy || _preparing) return;
    if (source == PhotoSource.camera && !await _repo.cameraExplained()) {
      if (!mounted) return;
      final go = await _explainCamera(context);
      if (!go) return;
      await _repo.setCameraExplained();
    }
    setState(() {
      _preparing = true;
      _error = null;
    });
    try {
      final photo = await ref.read(photoPickerProvider)(source);
      if (photo != null && mounted) setState(() => _attachment = photo);
    } on PhotoException catch (e) {
      if (!mounted) return;
      if (e.failure == PhotoFailure.denied) {
        await _explainDenied(context, source);
      } else {
        setState(() => _error = AppLocalizations.of(context).niroPhotoFailed);
      }
    } finally {
      if (mounted) setState(() => _preparing = false);
    }
  }

  Future<void> _send([String? text]) async {
    final l10n = AppLocalizations.of(context);
    final message = (text ?? _input.text).trim();
    final photo = _attachment;
    if ((message.isEmpty && photo == null) || _busy || _preparing) return;
    final history = buildHistory(_turns, newPhoto: photo != null);
    final cancel = CancelToken();
    setState(() {
      _turns = [
        ..._turns,
        NiroTurn(
          role: 'user',
          content: message,
          image: photo?.jpeg,
          thumb: photo?.thumb,
        ),
      ];
      _input.clear();
      _attachment = null;
      _error = null;
      _limit = null;
      _status = _Status.waiting;
      _cancel = cancel;
    });
    _toEnd();

    void finish() {
      if (!mounted) return;
      setState(() {
        _status = _Status.idle;
        _cancel = null;
        _sub = null;
      });
      _save();
      // Keep "X messages left today" current.
      ref.invalidate(planProvider);
    }

    var started = false;
    _sub = _repo
        .ask(
          message: message,
          imageDataUrl: photo == null ? null : jpegDataUrl(photo.jpeg),
          history: history,
          cancelToken: cancel,
        )
        .listen(
          (answer) {
            if (!mounted) return;
            setState(() {
              if (!started) {
                started = true;
                _turns = [
                  ..._turns,
                  NiroTurn(role: 'assistant', content: answer),
                ];
              } else {
                _turns = [
                  ..._turns.sublist(0, _turns.length - 1),
                  _turns.last.withContent(answer),
                ];
              }
              _status = _Status.streaming;
            });
            _toEnd();
          },
          onDone: finish,
          onError: (Object error) {
            if (!mounted) return;
            if (cancel.isCancelled) {
              finish();
              return;
            }
            // Drop the unanswered question (and any empty answer) so a retry
            // doesn't duplicate it — and give the text / photo back.
            final trimmed = [..._turns];
            while (trimmed.isNotEmpty &&
                !trimmed.last.isUser &&
                trimmed.last.content.isEmpty) {
              trimmed.removeLast();
            }
            if (trimmed.isNotEmpty && trimmed.last.isUser) trimmed.removeLast();
            setState(() {
              _turns = trimmed;
              _input.text = message;
              _attachment = photo;
              _limit = error is PlanLimitException ? error.details : null;
              _error = error is ApiException
                  ? error.message
                  : l10n.niroUnreachable;
            });
            finish();
          },
          cancelOnError: true,
        );
  }

  void _stop() {
    // Stopped by the student: keep whatever was already written.
    _cancel?.cancel();
    _sub?.cancel();
    setState(() {
      if (_turns.isNotEmpty &&
          !_turns.last.isUser &&
          _turns.last.content.isEmpty) {
        _turns = _turns.sublist(0, _turns.length - 1);
      }
      _status = _Status.idle;
      _cancel = null;
      _sub = null;
    });
    _save();
  }

  void _newChat() {
    _cancel?.cancel();
    _sub?.cancel();
    setState(() {
      _turns = const [];
      _error = null;
      _limit = null;
      _attachment = null;
      _status = _Status.idle;
      _cancel = null;
      _sub = null;
    });
    _save();
  }

  Future<void> _copy(int index, String text) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    setState(() => _copied = index);
    Timer(const Duration(milliseconds: 1500), () {
      if (mounted && _copied == index) setState(() => _copied = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final name = ref.watch(myNameProvider).value?.trim().split(' ').first;
    final assistant = ref.watch(planProvider).value?.assistant;
    final lastHadImage =
        _turns.isNotEmpty && _turns.last.isUser && _turns.last.image != null;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: NlSpace.page,
        title: Row(
          children: [
            const NiroImage(expression: NiroExpression.normal, size: 40),
            const SizedBox(width: NlSpace.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.niroTitle, style: NlText.title),
                  Text(
                    l10n.niroSubtitle,
                    style: NlText.caption,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          if (_turns.isNotEmpty)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: NlSpace.sm),
              child: NlButton(
                label: l10n.niroNewChat,
                kind: NlButtonKind.ghost,
                icon: LucideIcons.rotateCcw,
                onPressed: _newChat,
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              controller: _scroll,
              padding: const EdgeInsets.fromLTRB(
                NlSpace.page,
                NlSpace.sm,
                NlSpace.page,
                NlSpace.lg,
              ),
              children: [
                if (_turns.isEmpty)
                  _Welcome(
                    name: name,
                    onStarter: (s) => _send(s),
                    onCamera: () => _pick(PhotoSource.camera),
                  ),
                for (final (i, turn) in _turns.indexed)
                  turn.isUser
                      ? _UserBubble(turn: turn)
                      : turn.content.isEmpty
                      ? const SizedBox.shrink()
                      : _AnswerBubble(
                          text: turn.content,
                          copied: _copied == i,
                          onCopy: _busy && i == _turns.length - 1
                              ? null
                              : () => _copy(i, turn.content),
                        ),
                if (_status == _Status.waiting)
                  _Thinking(
                    text: lastHadImage
                        ? l10n.niroReadingPhoto
                        : l10n.askThinking,
                  ),
                if (_error != null)
                  _limit != null
                      ? _LimitCard(message: _error!, details: _limit!)
                      : Padding(
                          padding: const EdgeInsets.only(top: NlSpace.sm),
                          child: Text(
                            _error!,
                            style: NlText.secondary.copyWith(
                              color: NlColors.wrong,
                            ),
                          ),
                        ),
                if (_error == null && assistant != null)
                  ?_remaining(l10n, assistant),
              ],
            ),
          ),
          _Composer(
            input: _input,
            attachment: _attachment,
            preparing: _preparing,
            busy: _busy,
            onCamera: () => _pick(PhotoSource.camera),
            onGallery: () => _pick(PhotoSource.gallery),
            onRemovePhoto: () => setState(() => _attachment = null),
            onSend: _send,
            onStop: _stop,
          ),
        ],
      ),
    );
  }

  /// The web's RemainingHint: shown only when ≤ 20% of today's messages are
  /// left (without the web's "get more" link — no purchases in the app).
  Widget? _remaining(AppLocalizations l10n, UsageMeter meter) {
    final limit = meter.limit;
    if (limit == null || limit <= 0) return null;
    final left = (limit - meter.used).clamp(0, limit);
    if (left == 0 || left / limit > 0.2) return null;
    return Padding(
      padding: const EdgeInsets.only(top: NlSpace.sm),
      child: Text(l10n.niroRemaining(left), style: NlText.caption),
    );
  }
}

Future<bool> _explainCamera(BuildContext context) async {
  final l10n = AppLocalizations.of(context);
  final result = await showNlSheet<bool>(
    context,
    title: l10n.niroCameraTitle,
    builder: (context) => SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final line in [
            l10n.niroCameraWhy1,
            l10n.niroCameraWhy2,
            l10n.niroCameraWhy3,
            l10n.niroCameraWhy4,
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: NlSpace.sm),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Icon(
                      LucideIcons.check,
                      size: 16,
                      color: NlColors.correct,
                    ),
                  ),
                  const SizedBox(width: NlSpace.sm),
                  Expanded(child: Text(line, style: NlText.body)),
                ],
              ),
            ),
          const SizedBox(height: NlSpace.md),
          NlButton(
            label: l10n.actionContinue,
            expand: true,
            onPressed: () => Navigator.of(context).pop(true),
          ),
          const SizedBox(height: NlSpace.sm),
          NlButton(
            label: l10n.niroNotNow,
            kind: NlButtonKind.secondary,
            expand: true,
            onPressed: () => Navigator.of(context).pop(false),
          ),
        ],
      ),
    ),
  );
  return result ?? false;
}

Future<void> _explainDenied(BuildContext context, PhotoSource source) {
  final l10n = AppLocalizations.of(context);
  return showNlSheet<void>(
    context,
    title: source == PhotoSource.camera
        ? l10n.niroCameraDenied
        : l10n.niroPhotosDenied,
    builder: (context) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l10n.niroDeniedHint, style: NlText.body),
        const SizedBox(height: NlSpace.lg),
        if (Platform.isIOS)
          NlButton(
            label: l10n.niroOpenSettings,
            expand: true,
            onPressed: () {
              Navigator.of(context).pop();
              launchUrl(Uri.parse('app-settings:'));
            },
          ),
        const SizedBox(height: NlSpace.sm),
        NlButton(
          label: l10n.actionClose,
          kind: NlButtonKind.secondary,
          expand: true,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    ),
  );
}

const _starters = [
  'اشرحلي فكرة صعبة ببساطة 🧠',
  'اختبرني 📝',
  'ساعدني أحفظ معلومة ✨',
  'أعطني تحدي 😏',
  'شو أدرس بعدها؟ 📅',
];

class _Welcome extends StatelessWidget {
  const _Welcome({
    required this.name,
    required this.onStarter,
    required this.onCamera,
  });

  final String? name;
  final ValueChanged<String> onStarter;
  final VoidCallback onCamera;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: NlSpace.xl),
      child: Column(
        children: [
          const NiroImage(expression: NiroExpression.explaining, size: 132),
          const SizedBox(height: NlSpace.md),
          Text(
            name == null || name!.isEmpty
                ? l10n.niroHello
                : l10n.niroHelloName(isolate(name!)),
            style: NlText.title,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            l10n.niroAskAnything,
            style: NlText.secondary,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: NlSpace.lg),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: NlSpace.sm,
            runSpacing: NlSpace.sm,
            children: [
              for (final s in _starters)
                ActionChip(label: Text(s), onPressed: () => onStarter(s)),
              ActionChip(
                avatar: const Icon(LucideIcons.camera, size: 16),
                label: Text(l10n.niroStarterPhoto),
                onPressed: onCamera,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.turn});
  final NiroTurn turn;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final photo = turn.thumb ?? turn.image;
    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.all(NlSpace.md),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.82,
        ),
        decoration: BoxDecoration(
          color: NlColors.ink,
          borderRadius: BorderRadius.circular(NlRadius.md),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (photo != null)
              Padding(
                padding: EdgeInsets.only(
                  bottom: turn.content.isEmpty ? 0 : NlSpace.sm,
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(NlRadius.sm),
                  child: Semantics(
                    label: l10n.niroSentPhoto,
                    image: true,
                    child: Image.memory(photo, height: 160, fit: BoxFit.cover),
                  ),
                ),
              ),
            if (turn.content.isNotEmpty)
              SelectableText(
                turn.content,
                textDirection: contentDirection(turn.content),
                style: NlText.body.copyWith(color: Colors.white),
              ),
          ],
        ),
      ),
    );
  }
}

class _AnswerBubble extends StatelessWidget {
  const _AnswerBubble({
    required this.text,
    required this.copied,
    required this.onCopy,
  });

  final String text;
  final bool copied;
  final VoidCallback? onCopy;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(NlSpace.md),
      decoration: BoxDecoration(
        color: NlColors.sheet,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const NiroImage(expression: NiroExpression.normal, size: 22),
              const SizedBox(width: 6),
              Text('Niro', style: NlText.label),
            ],
          ),
          const SizedBox(height: NlSpace.sm),
          NlRichText(text),
          if (onCopy != null)
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: NlButton(
                label: copied ? l10n.niroCopied : l10n.niroCopy,
                kind: NlButtonKind.ghost,
                icon: copied ? LucideIcons.check : LucideIcons.copy,
                onPressed: onCopy,
              ),
            ),
        ],
      ),
    );
  }
}

class _Thinking extends StatelessWidget {
  const _Thinking({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: NlSpace.md),
        child: Row(
          children: [
            const NiroImage(expression: NiroExpression.explaining, size: 32),
            const SizedBox(width: NlSpace.sm),
            const SizedBox.square(
              dimension: 14,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: NlSpace.sm),
            Flexible(child: Text(text, style: NlText.caption)),
          ],
        ),
      ),
    );
  }
}

/// Informational only — what the limit is, never a purchase.
class _LimitCard extends StatelessWidget {
  const _LimitCard({required this.message, required this.details});

  final String message;
  final PlanLimitDetails details;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: NlSpace.sm),
      padding: const EdgeInsets.all(NlSpace.lg),
      decoration: BoxDecoration(
        color: NlColors.markerSoft,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.marker),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(details.title, style: NlText.rowLabel),
          const SizedBox(height: 4),
          Text(message, style: NlText.body),
        ],
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.input,
    required this.attachment,
    required this.preparing,
    required this.busy,
    required this.onCamera,
    required this.onGallery,
    required this.onRemovePhoto,
    required this.onSend,
    required this.onStop,
  });

  final TextEditingController input;
  final PreparedPhoto? attachment;
  final bool preparing;
  final bool busy;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback onRemovePhoto;
  final VoidCallback onSend;
  final VoidCallback onStop;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final canSend =
        (input.text.trim().isNotEmpty || attachment != null) && !preparing;
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: NlColors.sheet,
        border: Border(top: BorderSide(color: NlColors.rule)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          NlSpace.sm,
          NlSpace.sm,
          NlSpace.sm,
          NlSpace.sm,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (attachment != null || preparing)
              Padding(
                padding: const EdgeInsets.only(bottom: NlSpace.sm),
                child: SizedBox(
                  width: 72,
                  height: 72,
                  child: preparing
                      ? const Center(child: CircularProgressIndicator())
                      : Stack(
                          fit: StackFit.expand,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(NlRadius.sm),
                              child: Image.memory(
                                attachment!.thumb,
                                fit: BoxFit.cover,
                                semanticLabel: l10n.niroAttachedPhoto,
                              ),
                            ),
                            PositionedDirectional(
                              top: -6,
                              end: -6,
                              child: IconButton(
                                tooltip: l10n.niroRemovePhoto,
                                visualDensity: VisualDensity.compact,
                                style: IconButton.styleFrom(
                                  backgroundColor: NlColors.ink,
                                  foregroundColor: Colors.white,
                                ),
                                icon: const Icon(LucideIcons.x, size: 14),
                                onPressed: onRemovePhoto,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  tooltip: l10n.niroCamera,
                  icon: const Icon(LucideIcons.camera),
                  onPressed: busy || preparing ? null : onCamera,
                ),
                IconButton(
                  tooltip: l10n.niroGallery,
                  icon: const Icon(LucideIcons.imagePlus),
                  onPressed: busy || preparing ? null : onGallery,
                ),
                Expanded(
                  child: TextField(
                    controller: input,
                    minLines: 1,
                    maxLines: 5,
                    maxLength: 4000,
                    textInputAction: TextInputAction.newline,
                    decoration: InputDecoration(
                      hintText: attachment != null
                          ? l10n.niroHintPhoto
                          : l10n.niroHint,
                      counterText: '',
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                busy
                    ? IconButton.filled(
                        tooltip: l10n.askStop,
                        icon: const Icon(LucideIcons.square, size: 18),
                        onPressed: onStop,
                      )
                    : IconButton.filled(
                        tooltip: l10n.askSend,
                        icon: const Icon(LucideIcons.send, size: 20),
                        onPressed: canSend ? onSend : null,
                      ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
