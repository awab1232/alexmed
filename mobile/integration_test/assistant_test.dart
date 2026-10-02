// Niro on a device: the real photo pipeline (flutter_image_compress on
// Android — large photo downsized, HEIC → JPEG, EXIF dropped) and the chat
// screens with a scripted reply (no server). Pauses on each screen for
// `adb exec-out screencap`.

import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/app/router.dart';
import 'package:nirolearn/core/ui/ui.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/assistant/data/assistant_repository.dart';
import 'package:nirolearn/features/assistant/data/photo_prep.dart';
import 'package:nirolearn/features/assistant/domain/niro_turn.dart';
import 'package:nirolearn/features/auth/data/auth_repository.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';

import '../test/features/assistant/assistant_test.dart'
    show FakeAssistantRepository;
import '../test/helpers/app_harness.dart';
import '../test/helpers/fake_http.dart';

Future<void> hold(WidgetTester tester, String label) async {
  debugPrint('SCREEN $label');
  for (var i = 0; i < 24; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

Future<Uint8List> paintedPng(int width, int height) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawRect(
    Rect.fromLTWH(0, 0, width.toDouble(), height.toDouble()),
    Paint()..color = const Color(0xFF3355FF),
  );
  canvas.drawCircle(
    Offset(width / 2, height / 2),
    height / 3,
    Paint()..color = const Color(0xFFFFD43B),
  );
  final image = await recorder.endRecording().toImage(width, height);
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  return data!.buffer.asUint8List();
}

Future<Size> sizeOf(Uint8List bytes) async {
  final codec = await ui.instantiateImageCodec(bytes);
  final frame = await codec.getNextFrame();
  return Size(frame.image.width.toDouble(), frame.image.height.toDouble());
}

bool isJpeg(Uint8List b) => b.length > 3 && b[0] == 0xFF && b[1] == 0xD8;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('photo pipeline: 4000×3000 → JPEG ≤1600, HEIC → JPEG', (
    tester,
  ) async {
    await tester.runAsync(() async {
      final big = await paintedPng(4000, 3000);
      final prepared = await preparePhotoBytes(big);
      expect(isJpeg(prepared.jpeg), isTrue);
      final size = await sizeOf(prepared.jpeg);
      debugPrint(
        'PHOTO big ${big.length} B → ${prepared.jpeg.length} B, $size',
      );
      expect(size.longestSide, lessThanOrEqualTo(1600));
      expect(size.width / size.height, closeTo(4 / 3, 0.01));
      final thumb = await sizeOf(prepared.thumb);
      expect(thumb.longestSide, lessThanOrEqualTo(1600));
      expect(thumb.shortestSide, lessThanOrEqualTo(320));

      final heic = await FlutterImageCompress.compressWithList(
        big,
        minWidth: 2000,
        minHeight: 1500,
        format: CompressFormat.heic,
      );
      expect(isJpeg(heic), isFalse);
      final fromHeic = await preparePhotoBytes(heic);
      debugPrint('PHOTO heic ${heic.length} B → ${fromHeic.jpeg.length} B');
      expect(isJpeg(fromHeic.jpeg), isTrue);
      expect(
        (await sizeOf(fromHeic.jpeg)).longestSide,
        lessThanOrEqualTo(1600),
      );
    });
  });

  testWidgets('niro screens', (tester) async {
    final repo = FakeAssistantRepository();
    final png = await tester.runAsync(() => paintedPng(1200, 900));
    final photo = await tester.runAsync(() => preparePhotoBytes(png!));

    await tester.pumpWidget(
      ProviderScope(
        retry: noAutomaticRetry,
        overrides: [
          envProvider.overrideWithValue(testEnv),
          sessionStoreProvider.overrideWithValue(MemorySessionStore(signedIn)),
          authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
          libraryRepositoryProvider.overrideWithValue(FakeLibraryRepository()),
          accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
          assistantRepositoryProvider.overrideWithValue(repo),
          photoPickerProvider.overrideWithValue((_) async => photo),
        ],
        child: const NiroLearnApp(),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    final router = ProviderScope.containerOf(
      tester.element(find.byType(NlBottomNav)),
    ).read(routerProvider);
    router.go(Routes.assistant);
    await hold(tester, 'niro-welcome');

    await tester.tap(find.byTooltip('تصوير بالكاميرا'));
    await hold(tester, 'niro-camera-sheet');
    await tester.tap(find.text('متابعة'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.enterText(find.byType(TextField), 'حل السؤال الثاني');
    await hold(tester, 'niro-attached');

    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.byTooltip('إرسال'));
    await hold(tester, 'niro-reading-photo');
    const answer =
        '## الحل\n'
        'السؤال يطلب **الدواء المدر العروي**:\n\n'
        '1. Furosemide → يعمل على عروة هنلي\n'
        '2. ليس Spironolactone\n\n'
        '| Drug | Class |\n|---|---|\n| Furosemide | Loop |\n| Mannitol | Osmotic |\n\n'
        '> ملاحظة: الجرعة \\(\\frac{40}{2}\\) mg';
    for (var i = 20; i < answer.length; i += 20) {
      repo.reply!.add(answer.substring(0, i));
      await tester.pump(const Duration(milliseconds: 80));
    }
    repo.reply!.add(answer);
    await repo.reply!.close();
    await hold(tester, 'niro-answer');
    expect(repo.saved.whereType<NiroTurn>().length, 2);
  });
}
