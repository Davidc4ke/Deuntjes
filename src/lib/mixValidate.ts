import { db } from '@/db/client';
import {
  sections as sectionsTable,
  slots as slotsTable,
  takes,
} from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export type SelectionInput = {
  slot_id?: string;
  slotId?: string;
  section_id?: string | null;
  sectionId?: string | null;
  take_id?: string;
  takeId?: string;
};

export type NormalizedSelection = {
  slotId: string;
  sectionId: string | null;
  takeId: string;
};

export type ValidateResult =
  | { ok: true; rows: NormalizedSelection[] }
  | { ok: false; error: string };

export async function validateSelections(
  versionId: string,
  raw: SelectionInput[],
): Promise<ValidateResult> {
  if (raw.length === 0) return { ok: true, rows: [] };

  const normalized: NormalizedSelection[] = [];
  for (const item of raw) {
    const slotId = (item.slot_id ?? item.slotId ?? '').toString();
    const takeId = (item.take_id ?? item.takeId ?? '').toString();
    const sectionIdRaw = item.section_id ?? item.sectionId ?? null;
    const sectionId = sectionIdRaw && String(sectionIdRaw).trim() ? String(sectionIdRaw) : null;
    if (!slotId || !takeId) {
      return { ok: false, error: 'selection requires slot_id and take_id' };
    }
    normalized.push({ slotId, sectionId, takeId });
  }

  const slotIds = Array.from(new Set(normalized.map((s) => s.slotId)));
  const slotRows = await db
    .select()
    .from(slotsTable)
    .where(and(inArray(slotsTable.id, slotIds), eq(slotsTable.songVersionId, versionId)));
  if (slotRows.length !== slotIds.length) {
    return { ok: false, error: 'slot does not belong to version' };
  }

  const sectionIds = Array.from(
    new Set(normalized.map((s) => s.sectionId).filter((s): s is string => s !== null)),
  );
  if (sectionIds.length > 0) {
    const sectionRows = await db
      .select()
      .from(sectionsTable)
      .where(and(inArray(sectionsTable.id, sectionIds), eq(sectionsTable.songVersionId, versionId)));
    if (sectionRows.length !== sectionIds.length) {
      return { ok: false, error: 'section does not belong to version' };
    }
  }

  const takeIds = Array.from(new Set(normalized.map((s) => s.takeId)));
  const takeRows = await db.select().from(takes).where(inArray(takes.id, takeIds));
  const takesById = new Map(takeRows.map((t) => [t.id, t]));
  for (const sel of normalized) {
    const t = takesById.get(sel.takeId);
    if (!t) return { ok: false, error: 'take not found' };
    if (t.slotId !== sel.slotId) {
      return { ok: false, error: 'take does not belong to its slot' };
    }
    if (sel.sectionId !== null && t.sectionId !== null && t.sectionId !== sel.sectionId) {
      return { ok: false, error: 'take is locked to a different section' };
    }
  }

  const seen = new Set<string>();
  for (const sel of normalized) {
    const key = `${sel.slotId}|${sel.sectionId ?? ''}`;
    if (seen.has(key)) return { ok: false, error: 'duplicate selection for slot/section' };
    seen.add(key);
  }

  return { ok: true, rows: normalized };
}
