import { create } from "zustand";
import type { AddTorrentSource } from "../lib/addTorrentSource";
import type { ApiAddTorrentResponse } from "../lib/types";

export type Section =
  | "library"
  | "downloading"
  | "seeding"
  | "completed"
  | "network"
  | "rss"
  | "search"
  | "stats"
  | "settings"
  | "advanced";
export type ViewDensity = "comfortable" | "compact";
export type SortMode = "custom" | "name" | "size" | "progress" | "added";

interface UiState {
  section: Section;
  setSection: (section: Section) => void;

  labelFilter: string | null;
  setLabelFilter: (label: string | null) => void;

  density: ViewDensity;
  setDensity: (density: ViewDensity) => void;

  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;

  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  selectOnly: (id: string) => void;
  clearSelection: () => void;

  detailId: string | null;
  openDetail: (id: string) => void;
  closeDetail: () => void;

  addDialogOpen: boolean;
  setAddDialogOpen: (open: boolean) => void;

  createDialogOpen: boolean;
  setCreateDialogOpen: (open: boolean) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  reviewSource: AddTorrentSource | null;
  reviewPreview: ApiAddTorrentResponse | null;
  reviewPaused: boolean;
  openReview: (source: AddTorrentSource, preview: ApiAddTorrentResponse, paused: boolean) => void;
  closeReview: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  section: "library",
  setSection: (section) =>
    set({ section, detailId: null, reviewSource: null, reviewPreview: null }),

  labelFilter: null,
  setLabelFilter: (labelFilter) => set({ labelFilter, section: "library", detailId: null }),

  density: "comfortable",
  setDensity: (density) => set({ density }),

  sortMode: "added",
  setSortMode: (sortMode) => set({ sortMode }),

  selectedIds: new Set(),
  toggleSelected: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectOnly: (id) => set({ selectedIds: new Set([id]) }),
  clearSelection: () => set({ selectedIds: new Set() }),

  detailId: null,
  openDetail: (id) => set({ detailId: id }),
  closeDetail: () => set({ detailId: null }),

  addDialogOpen: false,
  setAddDialogOpen: (addDialogOpen) => set({ addDialogOpen }),

  createDialogOpen: false,
  setCreateDialogOpen: (createDialogOpen) => set({ createDialogOpen }),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  reviewSource: null,
  reviewPreview: null,
  reviewPaused: false,
  openReview: (reviewSource, reviewPreview, reviewPaused) =>
    set({ reviewSource, reviewPreview, reviewPaused }),
  closeReview: () => set({ reviewSource: null, reviewPreview: null }),
}));
