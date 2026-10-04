export type ArchiveMeta = { pinned: boolean; favorite: boolean };
export type ArchiveMetaMap = Record<string, ArchiveMeta>;

export const EMPTY_ARCHIVE_META: ArchiveMeta = { pinned: false, favorite: false };

export function getArchiveMeta(meta: ArchiveMetaMap, id: string): ArchiveMeta {
  return meta[id] ?? EMPTY_ARCHIVE_META;
}

export function toggleArchiveMeta(meta: ArchiveMetaMap, id: string, field: keyof ArchiveMeta): ArchiveMetaMap {
  const current = getArchiveMeta(meta, id);
  return { ...meta, [id]: { ...current, [field]: !current[field] } };
}
