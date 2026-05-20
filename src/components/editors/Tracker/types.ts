import type { TrackerNote, TrackerPayload } from '@/lib/render/trackerTake';

export type { TrackerNote, TrackerPayload };

export type Granularity = 4 | 8 | 16 | 32;

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  4: '1/4',
  8: '1/8',
  16: '1/16',
  32: '1/32',
};
