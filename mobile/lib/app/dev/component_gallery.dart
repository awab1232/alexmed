import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_error.dart';
import '../../core/ui/ui.dart';

/// Debug-only page showing every design-system piece in the current
/// language — for visual review against the web and for golden tests.
class ComponentGalleryScreen extends StatelessWidget {
  const ComponentGalleryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Design system')),
      body: ListView(
        // An explicit padding replaces ListView's automatic safe-area
        // padding, so the bottom inset (gesture bar) is added back here.
        padding: EdgeInsets.fromLTRB(
          NlSpace.page,
          NlSpace.page,
          NlSpace.page,
          NlSpace.page + MediaQuery.paddingOf(context).bottom,
        ),
        children: const [
          _Section('Type', _TypeSamples()),
          _Section('Buttons', _ButtonSamples()),
          _Section('Rows', _RowSamples()),
          _Section('Badges · progress', _BadgeSamples()),
          _Section('Mixed Arabic / English', _BidiSamples()),
          _Section('Niro', _NiroSamples()),
          _Section('States', _StateSamples()),
        ],
      ),
      bottomNavigationBar: NlBottomNav(
        items: const [
          NlNavItem(icon: LucideIcons.house, label: 'الرئيسية'),
          NlNavItem(icon: LucideIcons.gamepad2, label: 'ألعاب'),
          NlNavItem(icon: LucideIcons.sparkles, label: 'Niro'),
          NlNavItem(icon: LucideIcons.user, label: 'حسابي'),
        ],
        selectedIndex: 0,
        onSelected: (_) {},
        addLabel: 'إضافة',
        addIcon: LucideIcons.plus,
        onAdd: () {},
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section(this.title, this.child);

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: NlSpace.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: NlText.label),
          const SizedBox(height: NlSpace.sm),
          child,
        ],
      ),
    );
  }
}

class _TypeSamples extends StatelessWidget {
  const _TypeSamples();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('ذاكر بذكاء', style: NlText.display),
        Text('عنوان النافذة', style: NlText.title),
        Text('سطر في قائمة', style: NlText.rowLabel),
        Text('نص عادي يشرح الخطوة التالية بوضوح.', style: NlText.body),
        Text(
          'تنقل الخلايا العصبية الإشارات الكهربائية على طول المحور.',
          style: NlText.reading,
        ),
      ],
    );
  }
}

class _ButtonSamples extends StatelessWidget {
  const _ButtonSamples();

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: NlSpace.sm,
      runSpacing: NlSpace.sm,
      children: [
        NlButton(label: 'دخول', onPressed: () {}),
        NlButton(
          label: 'ابدأ المراجعة',
          kind: NlButtonKind.marker,
          icon: LucideIcons.play,
          onPressed: () {},
        ),
        NlButton(
          label: 'إلغاء',
          kind: NlButtonKind.secondary,
          onPressed: () {},
        ),
        NlButton(
          label: 'حذف نهائي',
          kind: NlButtonKind.destructive,
          onPressed: () {},
        ),
        NlButton(label: 'رابط', kind: NlButtonKind.ghost, onPressed: () {}),
        const NlButton(label: 'جاري الحفظ', loading: true, onPressed: null),
        const NlButton(label: 'غير متاح', onPressed: null),
      ],
    );
  }
}

class _RowSamples extends StatelessWidget {
  const _RowSamples();

  @override
  Widget build(BuildContext context) {
    return NlGroup(
      title: 'الحساب',
      children: [
        NlRow(
          icon: LucideIcons.userRound,
          label: 'الملف الدراسي',
          value: 'طب بشري، السنة الثالثة',
          onTap: () {},
        ),
        NlRow(
          icon: LucideIcons.atSign,
          label: 'اسم المستخدم للمشاركة',
          value: isolateLtr('@niro_student'),
          onTap: () {},
        ),
        NlRow(
          icon: LucideIcons.logOut,
          label: 'تسجيل الخروج',
          destructive: true,
          onTap: () {},
        ),
      ],
    );
  }
}

class _BadgeSamples extends StatelessWidget {
  const _BadgeSamples();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: NlSpace.sm,
          children: [NlBadge('باقة Free', marked: true), NlBadge('أدمن')],
        ),
        SizedBox(height: NlSpace.md),
        NlProgressBar(value: 0.35, semanticsLabel: 'السؤال 7 من 20'),
      ],
    );
  }
}

class _BidiSamples extends StatelessWidget {
  const _BidiSamples();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const AutoDirText('ما هو دور ACE inhibitor في علاج ارتفاع الضغط؟'),
        const AutoDirText('Which drug is a loop diuretic?'),
        Text('كود الوصول: ${isolateLtr('NL-7K2P-QX')}'),
        Text('رقم الهاتف: ${isolateLtr('079 123 4567')}'),
      ],
    );
  }
}

class _NiroSamples extends StatelessWidget {
  const _NiroSamples();

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: NlSpace.sm,
      runSpacing: NlSpace.sm,
      children: [
        for (final expression in NiroExpression.values)
          NiroImage(expression: expression, size: 72),
        const NiroImage.avatar(size: 40),
      ],
    );
  }
}

class _StateSamples extends StatelessWidget {
  const _StateSamples();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const NlOfflineBanner(),
        const SizedBox(height: NlSpace.md),
        const NlListSkeleton(rows: 2),
        SizedBox(
          height: 360,
          child: NlErrorView(error: const NetworkException(), onRetry: () {}),
        ),
      ],
    );
  }
}
