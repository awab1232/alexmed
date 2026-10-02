import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/ui/dates.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../data/doctor_set_models.dart';

/// The web's StatusChip.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.tone});

  final String label;
  final StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      StatusTone.live => (NlColors.correctSoft, NlColors.correct),
      StatusTone.warn => (NlColors.markerSoft, NlColors.ink),
      StatusTone.stop => (NlColors.wrongSoft, NlColors.wrong),
      StatusTone.muted => (NlColors.paper, NlColors.ink3),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: NlText.caption.copyWith(
          fontSize: 12,
          color: fg,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// A bordered block for a notice, an empty state or a form section.
class DoctorPanel extends StatelessWidget {
  const DoctorPanel({
    super.key,
    required this.children,
    this.color = NlColors.sheet,
  });

  final List<Widget> children;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: NlSpace.md),
      padding: const EdgeInsets.all(NlSpace.lg),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(NlRadius.md),
        border: Border.all(color: NlColors.rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, c) in children.indexed) ...[
            if (i > 0) const SizedBox(height: NlSpace.sm),
            c,
          ],
        ],
      ),
    );
  }
}

/// A list row: icon, title, meta line, trailing widget.
class DoctorRow extends StatelessWidget {
  const DoctorRow({
    super.key,
    required this.title,
    this.meta,
    this.leading,
    this.trailing,
    this.onTap,
    this.ltrTitle = false,
  });

  final String title;
  final String? meta;
  final IconData? leading;
  final Widget? trailing;
  final VoidCallback? onTap;

  /// Codes read left-to-right.
  final bool ltrTitle;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 60),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
          child: Row(
            children: [
              if (leading != null) ...[
                Icon(leading, size: 17, color: NlColors.ink2),
                const SizedBox(width: NlSpace.md),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ltrTitle
                        ? Text(
                            isolateLtr(title),
                            style: NlText.rowLabel.copyWith(
                              fontFamily: 'monospace',
                            ),
                          )
                        : AutoDirText(title, style: NlText.rowLabel),
                    if (meta != null && meta!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      AutoDirText(meta!, style: NlText.caption),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: NlSpace.sm),
                trailing!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The web's SetSettingsFields: title, description, subject, year, exam
/// type, listed / unlisted, optional start / end.
class SetSettingsForm extends StatefulWidget {
  const SetSettingsForm({
    super.key,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final SetSettings value;
  final ValueChanged<SetSettings> onChanged;
  final bool enabled;

  @override
  State<SetSettingsForm> createState() => _SetSettingsFormState();
}

class _SetSettingsFormState extends State<SetSettingsForm> {
  late final _title = TextEditingController(text: widget.value.title);
  late final _description = TextEditingController(
    text: widget.value.description,
  );
  late final _subject = TextEditingController(text: widget.value.subjectLabel);
  late final _year = TextEditingController(text: widget.value.academicYear);
  late final _exam = TextEditingController(text: widget.value.examType);

  @override
  void dispose() {
    for (final c in [_title, _description, _subject, _year, _exam]) {
      c.dispose();
    }
    super.dispose();
  }

  void _emit() => widget.onChanged(
    widget.value.copyWith(
      title: _title.text,
      description: _description.text,
      subjectLabel: _subject.text,
      academicYear: _year.text,
      examType: _exam.text,
    ),
  );

  Future<void> _pickDate({required bool start}) async {
    final current = start ? widget.value.startsAt : widget.value.endsAt;
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: current ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 5),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(current ?? now),
    );
    if (time == null) return;
    final picked = DateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
    );
    widget.onChanged(
      start
          ? widget.value.copyWith(startsAt: () => picked)
          : widget.value.copyWith(endsAt: () => picked),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    Widget field(
      TextEditingController c,
      String label, {
      int max = 120,
      int lines = 1,
      String? hint,
    }) => Padding(
      padding: const EdgeInsets.only(bottom: NlSpace.md),
      child: TextField(
        controller: c,
        enabled: widget.enabled,
        maxLength: max,
        minLines: lines,
        maxLines: lines == 1 ? 1 : 5,
        onChanged: (_) => _emit(),
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          counterText: '',
        ),
      ),
    );

    Widget dateRow(String label, DateTime? value, {required bool start}) => Row(
      children: [
        Expanded(
          child: Text(
            '$label: ${formatDateTime(context, value)}',
            style: NlText.body,
          ),
        ),
        NlButton(
          label: l10n.dsPickDate,
          kind: NlButtonKind.ghost,
          icon: LucideIcons.calendar,
          onPressed: widget.enabled ? () => _pickDate(start: start) : null,
        ),
        if (value != null)
          IconButton(
            tooltip: l10n.dsClearDate,
            icon: const Icon(LucideIcons.x, size: 18),
            onPressed: widget.enabled
                ? () => widget.onChanged(
                    start
                        ? widget.value.copyWith(startsAt: () => null)
                        : widget.value.copyWith(endsAt: () => null),
                  )
                : null,
          ),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        field(_title, l10n.dsTitle, max: 200, hint: 'Anatomy Midterm 2026'),
        field(_description, l10n.dsDescription, max: 2000, lines: 3),
        field(_subject, l10n.dsSubject),
        field(_year, l10n.dsYear),
        field(_exam, l10n.dsExamType, hint: 'Midterm / Final / Quiz'),
        Text(l10n.dsVisibility, style: NlText.label),
        RadioGroup<bool>(
          groupValue: widget.value.listed,
          onChanged: (v) {
            if (widget.enabled && v != null) {
              widget.onChanged(widget.value.copyWith(listed: v));
            }
          },
          child: Column(
            children: [
              RadioListTile<bool>(
                contentPadding: EdgeInsets.zero,
                value: false,
                enabled: widget.enabled,
                title: Text(l10n.dsUnlisted, style: NlText.body),
              ),
              RadioListTile<bool>(
                contentPadding: EdgeInsets.zero,
                value: true,
                enabled: widget.enabled,
                title: Text(l10n.dsListed, style: NlText.body),
              ),
            ],
          ),
        ),
        dateRow(l10n.dsStarts, widget.value.startsAt, start: true),
        dateRow(l10n.dsEnds, widget.value.endsAt, start: false),
      ],
    );
  }
}
