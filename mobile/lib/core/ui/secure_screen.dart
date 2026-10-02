import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// Protected content only (doctor sets, D7 recommended default): while this
/// widget is mounted, Android's FLAG_SECURE blocks screenshots, screen
/// recording and the recents-screen preview. Counted, so two protected
/// screens on the stack keep it on until the last one closes. iOS has no
/// public equivalent — the watermark stays the deterrent there.
class SecureScreen extends StatefulWidget {
  const SecureScreen({super.key, required this.child, this.enabled = true});

  final Widget child;
  final bool enabled;

  static const _channel = MethodChannel('nirolearn/secure_screen');
  static int _holders = 0;

  /// For tests.
  static int get holders => _holders;

  /// Debug builds only: lets an on-device visual test capture protected
  /// screens. Ignored in release builds.
  static bool debugAllowCapture = false;

  @override
  State<SecureScreen> createState() => _SecureScreenState();
}

class _SecureScreenState extends State<SecureScreen> {
  bool _holding = false;

  @override
  void initState() {
    super.initState();
    if (widget.enabled) _hold();
  }

  @override
  void dispose() {
    if (_holding) _release();
    super.dispose();
  }

  void _hold() {
    _holding = true;
    if (SecureScreen._holders++ == 0) _call('enable');
  }

  void _release() {
    _holding = false;
    if (--SecureScreen._holders == 0) _call('disable');
  }

  void _call(String method) {
    if (!Platform.isAndroid) return;
    if (kDebugMode && SecureScreen.debugAllowCapture && method == 'enable') {
      return;
    }
    SecureScreen._channel.invokeMethod<void>(method).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
