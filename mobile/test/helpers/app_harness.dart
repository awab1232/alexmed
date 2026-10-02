import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nirolearn/app/app.dart';
import 'package:nirolearn/app/providers.dart';
import 'package:nirolearn/core/auth/session_store.dart';
import 'package:nirolearn/core/storage/local_store.dart';
import 'package:nirolearn/features/account/data/account_repository.dart';
import 'package:nirolearn/features/auth/data/auth_repository.dart';
import 'package:nirolearn/features/library/data/library_models.dart';
import 'package:nirolearn/features/library/data/library_repository.dart';

import 'fake_http.dart';

/// In-memory library data; calls are recorded for assertions.
class FakeLibraryRepository implements LibraryRepository {
  List<Subject> folders = [];
  List<BookSummary> bookList = [];
  List<DeckSummary> deckList = [];
  int due = 0;
  SharedSummary shared = const SharedSummary();
  String? name = 'سارة أحمد';
  Object? failWith;
  final calls = <String>[];

  Future<T> _answer<T>(String call, T value) async {
    calls.add(call);
    if (failWith != null) throw failWith!;
    return value;
  }

  @override
  Future<List<Subject>> subjects() => _answer('subjects', folders);

  @override
  Future<Subject> subject(String id) =>
      _answer('subject:$id', folders.firstWhere((f) => f.id == id));

  @override
  Future<Subject> createSubject({required String name, required String type}) {
    final created = Subject(
      id: 'new-${folders.length}',
      name: name,
      type: type,
    );
    folders = [...folders, created];
    return _answer('create:$name:$type', created);
  }

  @override
  Future<void> renameSubject({required String id, required String name}) {
    folders = [
      for (final f in folders)
        f.id == id ? Subject(id: f.id, name: name, type: f.type) : f,
    ];
    return _answer('rename:$id:$name', null);
  }

  @override
  Future<void> deleteSubject(String id) {
    folders = folders.where((f) => f.id != id).toList();
    return _answer('delete:$id', null);
  }

  @override
  Future<List<BookSummary>> books() => _answer('books', bookList);

  @override
  Future<List<DeckSummary>> decks() => _answer('decks', deckList);

  @override
  Future<int> dueCount() => _answer('due', due);

  @override
  Future<void> moveBook({required String bookId, String? subjectId}) {
    bookList = [
      for (final b in bookList)
        b.id == bookId
            ? BookSummary(
                id: b.id,
                fileName: b.fileName,
                subjectId: subjectId,
                pageCount: b.pageCount,
              )
            : b,
    ];
    return _answer('moveBook:$bookId:$subjectId', null);
  }

  @override
  Future<void> moveDeck({required String deckId, String? subjectId}) =>
      _answer('moveDeck:$deckId:$subjectId', null);

  @override
  Future<SharedSummary> sharedSummary() => _answer('shared', shared);

  @override
  Future<String?> myName() => _answer('me', name);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeAccountRepository implements AccountRepository {
  AccountProfile me = const AccountProfile(
    id: 'u1',
    name: 'سارة أحمد',
    phone: '+962791234567',
    academicYear: 'السنة الثالثة',
    specialty: 'طب بشري',
  );
  PlanSummary planSummary = const PlanSummary(
    planId: 'free',
    planName: 'Free',
    subscribed: false,
    assistant: UsageMeter(used: 3, limit: 20),
    questionFiles: UsageMeter(used: 0, limit: 2),
    studyFiles: UsageMeter(used: 1, limit: 1),
    maxFileSizeMb: 20,
  );
  String? user = 'sara';
  bool doctorSets = false;
  DoctorStatus doctor = const DoctorStatus(approved: false);
  final calls = <String>[];

  @override
  Future<AccountProfile> profile() async => me;

  @override
  Future<void> updateProfile({String? academicYear, String? specialty}) async {
    calls.add('updateProfile:$academicYear:$specialty');
    me = AccountProfile(
      id: me.id,
      name: me.name,
      phone: me.phone,
      academicYear: academicYear,
      specialty: specialty,
    );
  }

  @override
  Future<PlanSummary> plan() async => planSummary;

  @override
  Future<String?> username() async => user;

  @override
  Future<bool> doctorSetsEnabled() async => doctorSets;

  @override
  Future<DoctorStatus> doctorStatus() async {
    calls.add('doctorStatus');
    return doctor;
  }

  @override
  Future<void> deleteAccount() async => calls.add('deleteAccount');

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class NoopAuthRepository implements AuthRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

final signedIn = StoredSession(token: 't', expiresAt: DateTime.utc(2099));

/// Pumps the whole app with in-memory data and a fixed session.
Future<
  ({
    FakeLibraryRepository library,
    FakeAccountRepository account,
    MemorySessionStore store,
  })
>
pumpNiroLearn(
  WidgetTester tester, {
  StoredSession? session,
  FakeLibraryRepository? library,
  FakeAccountRepository? account,
  Size size = const Size(412, 2200),
  bool settle = true,
}) async {
  tester.view.physicalSize = size * tester.view.devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  final lib = library ?? FakeLibraryRepository();
  final acc = account ?? FakeAccountRepository();
  final store = MemorySessionStore(session);
  await tester.pumpWidget(
    ProviderScope(
      retry: noAutomaticRetry,
      overrides: [
        envProvider.overrideWithValue(testEnv),
        sessionStoreProvider.overrideWithValue(store),
        localStoreProvider.overrideWithValue(MemoryLocalStore()),
        authRepositoryProvider.overrideWithValue(NoopAuthRepository()),
        libraryRepositoryProvider.overrideWithValue(lib),
        accountRepositoryProvider.overrideWithValue(acc),
      ],
      child: const NiroLearnApp(),
    ),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    // Screens with endless animations (a book being prepared) never settle.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }
  return (library: lib, account: acc, store: store);
}

/// Finds a Text by its visible content, ignoring the bidi isolation marks
/// (FSI / LRI … PDI) the app wraps file and folder names in.
Finder findLabel(String text) {
  // U+2066…U+2069 (LRI, RLI, FSI, PDI), built from code points.
  final marks = RegExp(
    '[${String.fromCharCode(0x2066)}-${String.fromCharCode(0x2069)}]',
  );
  return find.byWidgetPredicate(
    (widget) => widget is Text && widget.data?.replaceAll(marks, '') == text,
    description: 'Text "$text" (ignoring isolation marks)',
  );
}
