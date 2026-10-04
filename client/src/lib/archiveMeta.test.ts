import { describe, expect, it } from "vitest";
import { getArchiveMeta, toggleArchiveMeta, type ArchiveMetaMap } from "./archiveMeta";

describe("archive metadata", () => {
  it("defaults an archive item to unpinned and not favourite", () => {
    expect(getArchiveMeta({}, "014")).toEqual({ pinned: false, favorite: false });
  });

  it("toggles pin and favourite independently without mutating the input", () => {
    const initial: ArchiveMetaMap = { "014": { pinned: false, favorite: false } };
    const pinned = toggleArchiveMeta(initial, "014", "pinned");
    const favourite = toggleArchiveMeta(pinned, "014", "favorite");

    expect(initial["014"]).toEqual({ pinned: false, favorite: false });
    expect(favourite["014"]).toEqual({ pinned: true, favorite: true });
  });
});
