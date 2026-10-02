import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/routes.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/reader_repository.dart';

Future<void> _sheet(BuildContext context, Widget child) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.8,
          child: child,
        ),
      ),
    );

/// «اسأل Niro» about the selected text — or the whole page when nothing is
/// selected (the web's SelectionAssistant): quick actions, a free question,
/// follow-ups; the answer streams in as it is written and stops when the
/// sheet closes.
Future<void> showAskSelectionSheet(
  BuildContext context, {
  required String bookId,
  required String fileName,
  required int pageNumber,
  required String selectedText,
}) => _sheet(
  context,
  _AskSheet(
    bookId: bookId,
    fileName: fileName,
    pageNumber: pageNumber,
    selectedText: selectedText,
  ),
);

class _AskSheet extends ConsumerStatefulWidget {
  const _AskSheet({
    required this.bookId,
    required this.fileName,
    required this.pageNumber,
    required this.selectedText,
  });

  final String bookId;
  final String fileName;
  final int pageNumber;
  final String selectedText;

  @override
  ConsumerState<_AskSheet> createState() => _AskSheetState();
}

class _AskSheetState extends ConsumerState<_AskSheet> {
  final _turns = <ChatTurn>[];
  final _input = TextEditingController();
  CancelToken? _cancel;
  StreamSubscription<String>? _sub;
  String? _error;
  bool _waiting = false;

  bool get _busy => _cancel != null;

  @override
  void dispose() {
    _cancel?.cancel();
    _sub?.cancel();
    _input.dispose();
    super.dispose();
  }

  void _send(AskAction action, String label, {String? question}) {
    if (_busy) return;
    final history = [..._turns];
    final cancel = CancelToken();
    setState(() {
      _turns.add(ChatTurn(role: 'user', content: label));
      _input.clear();
      _error = null;
      _waiting = true;
      _cancel = cancel;
    });
    var started = false;
    _sub = ref
        .read(readerRepositoryProvider)
        .askSelection(
          bookId: widget.bookId,
          pageNumber: widget.pageNumber,
          selectedText: widget.selectedText,
          action: action,
          question: question,
          fileName: widget.fileName,
          history: history,
          cancelToken: cancel,
        )
        .listen(
          (answer) {
            if (!mounted) return;
            setState(() {
              _waiting = false;
              if (!started) {
                started = true;
                _turns.add(ChatTurn(role: 'assistant', content: answer));
              } else {
                _turns[_turns.length - 1] = ChatTurn(
                  role: 'assistant',
                  content: answer,
                );
              }
            });
          },
          onError: (Object error) {
            if (!mounted || cancel.isCancelled) return;
            setState(() {
              // Drop the unanswered prompt so a retry doesn't repeat it.
              _turns
                ..clear()
                ..addAll(history);
              _error = apiErrorText(context, error);
            });
          },
          onDone: () {
            if (mounted) {
              setState(() {
                _cancel = null;
                _waiting = false;
              });
            }
          },
          cancelOnError: true,
        );
  }

  void _stop() {
    _cancel?.cancel();
    _sub?.cancel();
    setState(() {
      _cancel = null;
      _waiting = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = widget.selectedText;
    final hasText = text.isNotEmpty;
    final actions = [
      (AskAction.explain, hasText ? l10n.askExplain : l10n.askExplainPage),
      (AskAction.arabic, l10n.askArabic),
      (AskAction.exam, l10n.askExam),
      (
        AskAction.summarize,
        hasText ? l10n.askSummarize : l10n.askSummarizePage,
      ),
    ];
    return _ChatFrame(
      title: l10n.askTitle(widget.pageNumber),
      header: Container(
        padding: const EdgeInsets.all(NlSpace.md),
        decoration: BoxDecoration(
          color: NlColors.markerSoft,
          borderRadius: BorderRadius.circular(NlRadius.md),
        ),
        child: AutoDirText(
          !hasText
              ? l10n.askWholePage(widget.pageNumber)
              : text.length > 400
              ? '${text.substring(0, 400)}…'
              : text,
          style: NlText.body,
        ),
      ),
      turns: _turns,
      waiting: _waiting,
      error: _error,
      quickActions: _turns.isEmpty
          ? [
              for (final (action, label) in actions)
                ActionChip(
                  label: Text(label),
                  onPressed: _busy ? null : () => _send(action, label),
                ),
            ]
          : const [],
      input: _input,
      busy: _busy,
      onSend: () {
        final q = _input.text.trim();
        if (q.isNotEmpty) _send(AskAction.ask, q, question: q);
      },
      onStop: _stop,
    );
  }
}

/// «اسأل Niro» about the whole book (the web's StudyAiSheet, book scope):
/// the conversation is kept on the server; answers stream in; an answer's
/// source pages open the reader there.
Future<void> showBookChatSheet(
  BuildContext context, {
  required String bookId,
  String? initialQuestion,
}) => _sheet(
  context,
  _BookChatSheet(bookId: bookId, initialQuestion: initialQuestion),
);

class _BookChatSheet extends ConsumerStatefulWidget {
  const _BookChatSheet({required this.bookId, this.initialQuestion});

  final String bookId;
  final String? initialQuestion;

  @override
  ConsumerState<_BookChatSheet> createState() => _BookChatSheetState();
}

class _BookChatSheetState extends ConsumerState<_BookChatSheet> {
  String? _sessionId;
  List<ChatTurn> _saved = const [];
  final _live = <ChatTurn>[];
  final _input = TextEditingController();
  CancelToken? _cancel;
  StreamSubscription<String>? _sub;
  String? _error;
  bool _waiting = false;

  ReaderRepository get _repo => ref.read(readerRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    _cancel?.cancel();
    _sub?.cancel();
    _input.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    try {
      final id = await _repo.chatSession(widget.bookId);
      final saved = await _repo.chatMessages(id);
      if (!mounted) return;
      setState(() {
        _sessionId = id;
        _saved = saved;
      });
      final q = widget.initialQuestion;
      if (q != null && q.trim().isNotEmpty) _ask(q);
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorText(context, error));
    }
  }

  void _ask(String text) {
    final question = text.trim();
    final id = _sessionId;
    if (question.isEmpty || id == null || _cancel != null) return;
    final cancel = CancelToken();
    setState(() {
      _live
        ..clear()
        ..add(ChatTurn(role: 'user', content: question));
      _input.clear();
      _error = null;
      _waiting = true;
      _cancel = cancel;
    });
    _sub = _repo
        .chatAsk(sessionId: id, question: question, cancelToken: cancel)
        .listen(
          (answer) {
            if (!mounted) return;
            setState(() {
              _waiting = false;
              if (_live.length == 1) {
                _live.add(ChatTurn(role: 'assistant', content: answer));
              } else {
                _live[1] = ChatTurn(role: 'assistant', content: answer);
              }
            });
          },
          onError: (Object error) {
            if (!mounted || cancel.isCancelled) return;
            setState(() {
              _live.clear();
              _input.text = question;
              _error = apiErrorText(context, error);
            });
          },
          onDone: () async {
            // The server saved both turns — show the saved copies (with
            // their source pages).
            final saved = await _repo
                .chatMessages(id)
                .catchError((_) => _saved);
            if (!mounted) return;
            setState(() {
              _saved = saved;
              _live.clear();
              _cancel = null;
              _waiting = false;
            });
          },
          cancelOnError: true,
        );
  }

  void _stop() {
    // What was written stays on screen; the server still saves the answer.
    _cancel?.cancel();
    _sub?.cancel();
    setState(() {
      _cancel = null;
      _waiting = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _ChatFrame(
      title: l10n.bookChatTitle,
      header: _saved.isEmpty && _live.isEmpty
          ? Text(l10n.bookChatHello, style: NlText.secondary)
          : null,
      turns: [..._saved, ..._live],
      waiting: _waiting || (_sessionId == null && _error == null),
      error: _error,
      quickActions: const [],
      input: _input,
      busy: _cancel != null || _sessionId == null,
      onSend: () => _ask(_input.text),
      onStop: _stop,
      onPage: (page) {
        Navigator.of(context).pop();
        context.push(Routes.bookRead(widget.bookId, page: page));
      },
    );
  }
}

/// Shared layout: title, header, messages, quick actions, input + send /
/// stop.
class _ChatFrame extends StatefulWidget {
  const _ChatFrame({
    required this.title,
    required this.turns,
    required this.waiting,
    required this.error,
    required this.quickActions,
    required this.input,
    required this.busy,
    required this.onSend,
    required this.onStop,
    this.header,
    this.onPage,
  });

  final String title;
  final Widget? header;
  final List<ChatTurn> turns;
  final bool waiting;
  final String? error;
  final List<Widget> quickActions;
  final TextEditingController input;
  final bool busy;
  final VoidCallback onSend;
  final VoidCallback onStop;
  final ValueChanged<int>? onPage;

  @override
  State<_ChatFrame> createState() => _ChatFrameState();
}

class _ChatFrameState extends State<_ChatFrame> {
  final _scroll = ScrollController();

  @override
  void didUpdateWidget(covariant _ChatFrame old) {
    super.didUpdateWidget(old);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        NlSpace.page,
        NlSpace.sm,
        NlSpace.page,
        NlSpace.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const NiroImage(expression: NiroExpression.explaining, size: 36),
              const SizedBox(width: NlSpace.sm),
              Expanded(child: Text(widget.title, style: NlText.title)),
              IconButton(
                tooltip: l10n.actionClose,
                icon: const Icon(LucideIcons.x),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          Expanded(
            child: ListView(
              controller: _scroll,
              children: [
                ?widget.header,
                const SizedBox(height: NlSpace.sm),
                for (final t in widget.turns)
                  _Bubble(turn: t, onPage: widget.onPage),
                if (widget.waiting)
                  Padding(
                    padding: const EdgeInsets.all(NlSpace.md),
                    child: Row(
                      children: [
                        const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        const SizedBox(width: NlSpace.sm),
                        Text(l10n.askThinking, style: NlText.caption),
                      ],
                    ),
                  ),
                if (widget.quickActions.isNotEmpty)
                  Wrap(
                    spacing: NlSpace.sm,
                    runSpacing: NlSpace.xs,
                    children: widget.quickActions,
                  ),
                if (widget.error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: NlSpace.sm),
                    child: Text(
                      widget.error!,
                      style: NlText.secondary.copyWith(color: NlColors.wrong),
                    ),
                  ),
              ],
            ),
          ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: widget.input,
                  minLines: 1,
                  maxLines: 4,
                  maxLength: 1000,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => widget.onSend(),
                  decoration: InputDecoration(
                    hintText: l10n.askHint,
                    counterText: '',
                  ),
                ),
              ),
              const SizedBox(width: NlSpace.sm),
              widget.busy && !widget.waiting && widget.turns.isNotEmpty
                  ? IconButton.filled(
                      tooltip: l10n.askStop,
                      icon: const Icon(LucideIcons.square),
                      onPressed: widget.onStop,
                    )
                  : IconButton.filled(
                      tooltip: l10n.askSend,
                      icon: const Icon(LucideIcons.send),
                      onPressed: widget.busy ? widget.onStop : widget.onSend,
                    ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.turn, this.onPage});

  final ChatTurn turn;
  final ValueChanged<int>? onPage;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final user = turn.isUser;
    return Align(
      alignment: user
          ? AlignmentDirectional.centerEnd
          : AlignmentDirectional.centerStart,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.all(NlSpace.md),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.85,
        ),
        decoration: BoxDecoration(
          color: user ? NlColors.ink : NlColors.sheet,
          borderRadius: BorderRadius.circular(NlRadius.md),
          border: user ? null : Border.all(color: NlColors.rule),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SelectableText(
              turn.content,
              textDirection: contentDirection(turn.content),
              style: NlText.body.copyWith(
                color: user ? Colors.white : NlColors.ink,
              ),
            ),
            if (turn.citedPages.isNotEmpty && onPage != null)
              Wrap(
                spacing: 4,
                children: [
                  for (final p in {...turn.citedPages})
                    ActionChip(
                      avatar: const Icon(LucideIcons.bookOpen, size: 14),
                      label: Text(l10n.quizPage(p)),
                      onPressed: () => onPage!(p),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
