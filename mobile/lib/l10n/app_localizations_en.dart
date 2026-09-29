// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'NiroLearn';

  @override
  String get tabHome => 'Home';

  @override
  String get tabGames => 'Games';

  @override
  String get tabAdd => 'Add';

  @override
  String get tabNiro => 'Niro';

  @override
  String get tabAccount => 'Account';

  @override
  String get actionRetry => 'Try again';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionConfirm => 'Confirm';

  @override
  String get actionClose => 'Close';

  @override
  String get actionSave => 'Save';

  @override
  String get actionContinue => 'Continue';

  @override
  String get loading => 'Loading…';

  @override
  String get offlineBanner =>
      'You\'re offline — showing what\'s saved on this device.';

  @override
  String get emptyTitle => 'Nothing here yet';

  @override
  String get errorTitle => 'Couldn\'t load this';

  @override
  String get errorNetwork =>
      'Couldn\'t connect. Check your internet and try again.';

  @override
  String get errorSessionExpired => 'Your session ended. Please sign in again.';

  @override
  String get errorForbidden => 'You don\'t have access to this content.';

  @override
  String get errorNotFound => 'Not available.';

  @override
  String get errorRateLimited =>
      'Too many attempts. Wait a moment and try again.';

  @override
  String get errorServer =>
      'Something went wrong on our side. Try again shortly.';

  @override
  String get errorRejected => 'This couldn\'t be done.';

  @override
  String underConstruction(String phase) {
    return 'Under construction — $phase';
  }

  @override
  String get welcomeTitle => 'Welcome';

  @override
  String get welcomeHeadline => 'Study smarter with Niro';

  @override
  String get welcomeBody =>
      'Upload a file and we turn it into a summary, flashcards and quizzes.';

  @override
  String get welcomeSignIn => 'Sign in';

  @override
  String get welcomeCreateAccount => 'Create account';

  @override
  String get loginTitle => 'Sign in';

  @override
  String get loginSubtitle => 'Welcome back to NiroLearn';

  @override
  String get loginIdentifier => 'Phone number or email';

  @override
  String get loginPassword => 'Password';

  @override
  String get loginSubmit => 'Sign in';

  @override
  String get loginSubmitting => 'Signing in...';

  @override
  String get loginNoAccount => 'No account yet?';

  @override
  String get loginCreateAccount => 'Create one';

  @override
  String get loginFillBoth =>
      'Enter your phone number (or email) and password.';

  @override
  String get showPassword => 'Show password';

  @override
  String get hidePassword => 'Hide password';

  @override
  String get sessionEndedNotice => 'Your session ended. Please sign in again.';

  @override
  String get registerTitle => 'Create account';

  @override
  String get registerPhoneStep => 'Your phone number';

  @override
  String get registerPhoneHint =>
      'We\'ll text you a code to confirm the number.';

  @override
  String get registerCountry => 'Country';

  @override
  String get registerPhone => 'Mobile number';

  @override
  String get registerSendCode => 'Send code';

  @override
  String get registerInvalidPhone =>
      'That phone number isn\'t valid. Check the number and the country.';

  @override
  String get registerCodeStep => 'Enter the code';

  @override
  String registerCodeSentTo(String phone) {
    return 'We sent a 6-digit code to $phone';
  }

  @override
  String get registerCode => 'Code';

  @override
  String get registerVerify => 'Confirm';

  @override
  String get registerResend => 'Send a new code';

  @override
  String registerResendIn(int seconds) {
    return 'Resend in ${seconds}s';
  }

  @override
  String get registerChangePhone => 'Change number';

  @override
  String get registerDetailsStep => 'Your details';

  @override
  String get registerName => 'Name';

  @override
  String get registerNameError => 'Enter your name (at least 2 letters).';

  @override
  String get registerPasswordError => 'Password must be at least 8 characters.';

  @override
  String get registerSubmit => 'Create account';

  @override
  String get registerHaveAccount => 'Already have an account?';

  @override
  String get registerTerms =>
      'By creating an account you agree to the Terms of Use and Privacy Policy.';
}
