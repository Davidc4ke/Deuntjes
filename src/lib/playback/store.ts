'use client';
import { create } from 'zustand';
import type { SlotKind } from '@/db/schema';

export type PlaybackState = {
  status: 'idle' | 'loading' | 'playing' | 'stopped';
  positionBar: number;
  totalBars: number;
  muted: Partial<Record<SlotKind, boolean>>;
  error: string | null;
  setStatus: (s: PlaybackState['status']) => void;
  setPosition: (bar: number) => void;
  setTotalBars: (b: number) => void;
  toggleMute: (slot: SlotKind) => void;
  setError: (e: string | null) => void;
  resetMutes: () => void;
};

export const usePlaybackStore = create<PlaybackState>((set) => ({
  status: 'idle',
  positionBar: 0,
  totalBars: 0,
  muted: {},
  error: null,
  setStatus: (s) => set({ status: s }),
  setPosition: (bar) => set({ positionBar: bar }),
  setTotalBars: (b) => set({ totalBars: b }),
  toggleMute: (slot) =>
    set((state) => ({ muted: { ...state.muted, [slot]: !state.muted[slot] } })),
  setError: (e) => set({ error: e }),
  resetMutes: () => set({ muted: {} }),
}));
