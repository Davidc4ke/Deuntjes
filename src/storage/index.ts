import { mkdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';

export interface StorageAdapter {
  put(path: string, bytes: Buffer | Uint8Array): Promise<void>;
  get(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

const root = process.env.STORAGE_PATH ?? './data';

function safeResolve(path: string): string {
  const normalized = normalize(path).replace(/^([./\\]+)/, '');
  if (normalized.split(sep).some((seg) => seg === '..')) {
    throw new Error('invalid storage path');
  }
  return join(root, normalized);
}

class LocalVolumeStorage implements StorageAdapter {
  async put(path: string, bytes: Buffer | Uint8Array) {
    const full = safeResolve(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes);
  }
  async get(path: string) {
    return readFile(safeResolve(path));
  }
  async delete(path: string) {
    try {
      await unlink(safeResolve(path));
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
  async exists(path: string) {
    try {
      await stat(safeResolve(path));
      return true;
    } catch {
      return false;
    }
  }
}

export const storage: StorageAdapter = new LocalVolumeStorage();
