import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/json.dart';
import '../../../core/api/trpc_client.dart';

// 📤 Study Pack sharing — sharing.* (lib/trpc/sharingRouter.ts). Every
// procedure derives "who" from the session; the app only sends the ids of
// what it acts on, and every rule (ownership, duplicates, blocks,
// cooldowns, rate limits) is the server's.

/// What a shared pack already contains (the web's ContentsChips).
final class PackContents {
  const PackContents({
    this.chapters = 0,
    this.flashcards = 0,
    this.questions = 0,
    this.examFocus,
  });

  factory PackContents.fromJson(Object? value) {
    if (value is! Map) return const PackContents();
    final json = asMap(value);
    return PackContents(
      chapters: json.integer('chapters'),
      flashcards: json.integer('flashcards'),
      questions: json.integer('questions'),
      examFocus: json.intOrNull('examFocus'),
    );
  }

  final int chapters;
  final int flashcards;
  final int questions;
  final int? examFocus;
}

String ownerLabel(String? name, String? username, String fallback) =>
    (name ?? '').isNotEmpty
    ? name!
    : ((username ?? '').isNotEmpty ? '@$username' : fallback);

final class IncomingRequest {
  const IncomingRequest({
    required this.shareId,
    required this.bookTitle,
    required this.contents,
    this.ownerName,
    this.ownerUsername,
    this.pageCount = 0,
    this.createdAt,
  });

  factory IncomingRequest.fromJson(JsonMap json) => IncomingRequest(
    shareId: json.str('shareId'),
    bookTitle: json.strOrNull('bookTitle') ?? '',
    ownerName: json.strOrNull('ownerName'),
    ownerUsername: json.strOrNull('ownerUsername'),
    pageCount: json.integer('pageCount'),
    createdAt: json.date('createdAt'),
    contents: PackContents.fromJson(json['contents']),
  );

  final String shareId;
  final String bookTitle;
  final String? ownerName;
  final String? ownerUsername;
  final int pageCount;
  final DateTime? createdAt;
  final PackContents contents;
}

final class SharedWithMe {
  const SharedWithMe({
    required this.shareId,
    required this.bookId,
    required this.bookTitle,
    required this.contents,
    this.ownerName,
    this.ownerUsername,
    this.sharedAt,
  });

  factory SharedWithMe.fromJson(JsonMap json) => SharedWithMe(
    shareId: json.str('shareId'),
    bookId: json.str('bookId'),
    bookTitle: json.strOrNull('bookTitle') ?? '',
    ownerName: json.strOrNull('ownerName'),
    ownerUsername: json.strOrNull('ownerUsername'),
    sharedAt: json.date('sharedAt'),
    contents: PackContents.fromJson(json['contents']),
  );

  final String shareId;
  final String bookId;
  final String bookTitle;
  final String? ownerName;
  final String? ownerUsername;
  final DateTime? sharedAt;
  final PackContents contents;
}

final class SharingNotification {
  const SharingNotification({
    required this.id,
    required this.type,
    this.bookTitle,
    this.text,
    this.actorName,
    this.actorUsername,
    this.read = false,
    this.createdAt,
  });

  factory SharingNotification.fromJson(JsonMap json) {
    final data = json['data'] is Map ? asMap(json['data']) : null;
    return SharingNotification(
      id: json.str('id'),
      type: json.strOrNull('type') ?? '',
      bookTitle: data?.strOrNull('bookTitle'),
      text: data?.strOrNull('text'),
      actorName: json.strOrNull('actorName'),
      actorUsername: json.strOrNull('actorUsername'),
      read: json['readAt'] != null,
      createdAt: json.date('createdAt'),
    );
  }

  final String id;

  /// share_request / share_accepted / share_declined / billing / …
  final String type;
  final String? bookTitle;
  final String? text;
  final String? actorName;
  final String? actorUsername;
  final bool read;
  final DateTime? createdAt;
}

final class StudentHit {
  const StudentHit({required this.id, required this.username, this.name});

  factory StudentHit.fromJson(JsonMap json) => StudentHit(
    id: json.str('id'),
    username: json.strOrNull('username') ?? '',
    name: json.strOrNull('name'),
  );

  final String id;
  final String username;
  final String? name;
}

/// sharesForBook row: pending / accepted / declined.
final class BookShare {
  const BookShare({
    required this.shareId,
    required this.status,
    this.recipientName,
    this.recipientUsername,
  });

  factory BookShare.fromJson(JsonMap json) => BookShare(
    shareId: json.str('shareId'),
    status: json.strOrNull('status') ?? 'pending',
    recipientName: json.strOrNull('recipientName'),
    recipientUsername: json.strOrNull('recipientUsername'),
  );

  final String shareId;
  final String status;
  final String? recipientName;
  final String? recipientUsername;
}

final class BlockedUser {
  const BlockedUser({required this.id, this.name, this.username});

  factory BlockedUser.fromJson(JsonMap json) => BlockedUser(
    id: json.str('id'),
    name: json.strOrNull('name'),
    username: json.strOrNull('username'),
  );

  final String id;
  final String? name;
  final String? username;
}

class SharingRepository {
  SharingRepository(this.trpc);

  final TrpcClient trpc;

  Future<String?> username() => trpc.query(
    'sharing.profile',
    offline: true,
    parse: (data) => data == null ? null : asMap(data).strOrNull('username'),
  );

  /// The server normalises and validates; returns the saved handle.
  Future<String> setUsername(String username) => trpc.mutation(
    'sharing.setUsername',
    input: {'username': username.trim()},
    parse: (data) => asMap(data).str('username'),
  );

  Future<({List<StudentHit> items, int? nextOffset})> search(
    String query, {
    int offset = 0,
  }) => trpc.query(
    'sharing.searchUsers',
    input: {'query': query, 'offset': offset},
    parse: (data) {
      final json = asMap(data);
      return (
        items: [
          for (final s in asMapList(json['items'])) StudentHit.fromJson(s),
        ],
        nextOffset: json.intOrNull('nextOffset'),
      );
    },
  );

  Future<void> sendRequest(String bookId, String recipientId) => trpc.mutation(
    'sharing.sendRequest',
    input: {'bookId': bookId, 'recipientId': recipientId},
    parse: (_) {},
  );

  Future<List<BookShare>> sharesForBook(String bookId) => trpc.query(
    'sharing.sharesForBook',
    input: {'bookId': bookId},
    parse: (data) => [for (final s in asMapList(data)) BookShare.fromJson(s)],
  );

  Future<void> revoke(String shareId) => trpc.mutation(
    'sharing.revoke',
    input: {'shareId': shareId},
    parse: (_) {},
  );

  Future<List<IncomingRequest>> incoming() => trpc.query(
    'sharing.incoming',
    parse: (data) => [
      for (final r in asMapList(data)) IncomingRequest.fromJson(r),
    ],
  );

  Future<void> respond(
    String shareId, {
    required bool accept,
    bool block = false,
  }) => trpc.mutation(
    'sharing.respond',
    input: {
      'shareId': shareId,
      'decision': accept ? 'accept' : 'decline',
      'block': block,
    },
    parse: (_) {},
  );

  Future<List<SharedWithMe>> sharedWithMe() => trpc.query(
    'sharing.sharedWithMe',
    offline: true,
    parse: (data) => [
      for (final r in asMapList(data)) SharedWithMe.fromJson(r),
    ],
  );

  Future<List<SharingNotification>> notifications() => trpc.query(
    'sharing.notifications',
    parse: (data) => [
      for (final n in asMapList(data)) SharingNotification.fromJson(n),
    ],
  );

  Future<void> markNotificationsRead() =>
      trpc.mutation('sharing.markNotificationsRead', parse: (_) {});

  Future<List<BlockedUser>> blocked() => trpc.query(
    'sharing.blocked',
    parse: (data) => [for (final u in asMapList(data)) BlockedUser.fromJson(u)],
  );

  Future<void> unblock(String userId) => trpc.mutation(
    'sharing.unblock',
    input: {'userId': userId},
    parse: (_) {},
  );
}

final sharingRepositoryProvider = Provider<SharingRepository>(
  (ref) => SharingRepository(ref.watch(trpcProvider)),
);

Object _scope(Ref ref) =>
    ref.watch(sessionControllerProvider.select((s) => s.status));

final incomingProvider = FutureProvider<List<IncomingRequest>>((ref) {
  _scope(ref);
  return ref.watch(sharingRepositoryProvider).incoming();
});

final sharedWithMeProvider = FutureProvider<List<SharedWithMe>>((ref) {
  _scope(ref);
  return ref.watch(sharingRepositoryProvider).sharedWithMe();
});

final notificationsProvider = FutureProvider<List<SharingNotification>>((ref) {
  _scope(ref);
  return ref.watch(sharingRepositoryProvider).notifications();
});

final blockedProvider = FutureProvider<List<BlockedUser>>((ref) {
  _scope(ref);
  return ref.watch(sharingRepositoryProvider).blocked();
});
