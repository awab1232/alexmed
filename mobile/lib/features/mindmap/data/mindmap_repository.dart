import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/json.dart';
import '../../../core/api/trpc_client.dart';
import '../../study/data/study_models.dart' show GenerationJob;

/// Arabic labels for visual asset types (the web page's ASSET_TYPE_LABEL_AR).
const assetTypeLabels = {
  'image': 'صورة',
  'diagram': 'مخطط',
  'table': 'جدول',
  'screenshot': 'لقطة',
  'chart': 'رسم بياني',
};

final class MindMapConcept {
  const MindMapConcept({
    required this.termEn,
    required this.termAr,
    this.explanationEn = '',
    this.explanationAr = '',
  });

  factory MindMapConcept.fromJson(JsonMap json) => MindMapConcept(
    termEn: json.strOrNull('termEn') ?? '',
    termAr: json.strOrNull('termAr') ?? '',
    explanationEn: json.strOrNull('explanationEn') ?? '',
    explanationAr: json.strOrNull('explanationAr') ?? '',
  );

  final String termEn;
  final String termAr;
  final String explanationEn;
  final String explanationAr;
}

/// One branch of a chapter map (lib/book-analysis.ts ChapterMindMapSection).
final class MindMapSection {
  const MindMapSection({
    required this.title,
    this.summaryEn = '',
    this.explanationAr = '',
    this.sourcePages = const [],
    this.concepts = const [],
    this.examPoints = const [],
    this.cardPrompts = const [],
  });

  factory MindMapSection.fromJson(JsonMap json) => MindMapSection(
    title: json.strOrNull('title') ?? '',
    summaryEn: json.strOrNull('summaryEn') ?? '',
    explanationAr: json.strOrNull('explanationAr') ?? '',
    sourcePages: _ints(json['sourcePages']),
    concepts: _maps(json['concepts']).map(MindMapConcept.fromJson).toList(),
    examPoints: _strings(json['examPoints']),
    cardPrompts: _strings(json['cardPrompts']),
  );

  final String title;
  final String summaryEn;
  final String explanationAr;
  final List<int> sourcePages;
  final List<MindMapConcept> concepts;
  final List<String> examPoints;
  final List<String> cardPrompts;
}

final class MindMapVisual {
  const MindMapVisual({
    required this.pageNumber,
    required this.assetType,
    this.descriptionEn,
  });

  factory MindMapVisual.fromJson(JsonMap json) => MindMapVisual(
    pageNumber: json.integer('pageNumber'),
    assetType: json.strOrNull('assetType') ?? '',
    descriptionEn: json.strOrNull('descriptionEn'),
  );

  final int pageNumber;
  final String assetType;
  final String? descriptionEn;
}

final class MindMapChapter {
  const MindMapChapter({
    required this.id,
    required this.title,
    this.keyPoints = const [],
    this.sections = const [],
    this.visuals = const [],
  });

  factory MindMapChapter.fromJson(JsonMap json) => MindMapChapter(
    id: json.str('id'),
    title: json.strOrNull('title') ?? '',
    keyPoints: _strings(json['keyPoints']),
    sections: _maps(json['mindMapSections'])
        .map(MindMapSection.fromJson)
        .toList(),
    visuals: _maps(json['visuals']).map(MindMapVisual.fromJson).toList(),
  );

  final String id;
  final String title;
  final List<String> keyPoints;
  final List<MindMapSection> sections;
  final List<MindMapVisual> visuals;
}

/// books.getMindMap — analysed chapters with their map branches.
final class MindMap {
  const MindMap({
    required this.fileName,
    required this.chapters,
    this.isOwner = true,
  });

  factory MindMap.fromJson(JsonMap json) {
    final access = json['access'] is Map ? asMap(json['access']) : null;
    return MindMap(
      fileName: asMap(json['book']).strOrNull('fileName') ?? '',
      chapters: _maps(json['chapters']).map(MindMapChapter.fromJson).toList(),
      isOwner: (access?.strOrNull('role') ?? 'owner') == 'owner',
    );
  }

  final String fileName;
  final List<MindMapChapter> chapters;
  final bool isOwner;

  int get branches => chapters.fold(0, (n, c) => n + c.sections.length);
  int get concepts => chapters.fold(
    0,
    (n, c) => n + c.sections.fold(0, (m, s) => m + s.concepts.length),
  );
  int get examPoints => chapters.fold(
    0,
    (n, c) => n + c.sections.fold(0, (m, s) => m + s.examPoints.length),
  );
}

/// The web's app/books/[bookId]/mindmap calls: read the map, queue a
/// chapter's map (a background job) and follow the jobs.
class MindMapRepository {
  MindMapRepository(this.trpc);

  final TrpcClient trpc;

  Future<MindMap> get(String bookId) => trpc.query(
    'books.getMindMap',
    offline: true,
    input: {'id': bookId},
    parse: (data) => MindMap.fromJson(asMap(data)),
  );

  Future<void> generate(String chapterId) => trpc.mutation(
    'books.generateMindMapSections',
    input: {'chapterId': chapterId},
    parse: (_) {},
  );

  Future<List<GenerationJob>> jobs(String bookId) => trpc.query(
    'books.generationJobs',
    input: {'bookId': bookId},
    parse: (data) => asMapList(data).map(GenerationJob.fromJson).toList(),
  );
}

final mindMapRepositoryProvider = Provider<MindMapRepository>(
  (ref) => MindMapRepository(ref.watch(trpcProvider)),
);

List<String> _strings(Object? value) => value is List
    ? [
        for (final v in value)
          if (v is String) v,
      ]
    : const [];

List<int> _ints(Object? value) => value is List
    ? [
        for (final v in value)
          if (v is num) v.toInt(),
      ]
    : const [];

List<JsonMap> _maps(Object? value) => value is List
    ? [
        for (final v in value)
          if (v is Map) asMap(v),
      ]
    : const [];
