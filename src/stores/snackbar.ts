import { create } from "zustand";

export interface SnackbarMessage {
  id: string;
  text: string;
  action?: { label: string; onClick: () => void };
}

interface SnackbarState {
  messages: SnackbarMessage[];
  push: (text: string, action?: SnackbarMessage["action"]) => void;
  dismiss: (id: string) => void;
}

export const useSnackbarStore = create<SnackbarState>((set) => ({
  messages: [],
  push: (text, action) => {
    const id = crypto.randomUUID();
    set((s) => ({ messages: [...s.messages, { id, text, action }] }));
    setTimeout(() => {
      set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
    }, 5000);
  },
  dismiss: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
}));
