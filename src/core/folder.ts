// Kalıcı kayıt klasörü: kütüphane ve ilerleme, kullanıcının seçtiği bir klasöre
// dosya olarak yazılır ve açılışta oradan okunur. Tarayıcı site verilerini silse
// bile (ör. "Chrome kapatılınca verileri sil" ayarı) okuma konumu kaybolmaz.
// Klasör bir bulut eşitleme klasörüyse (Google Drive, OneDrive) aynı dosyalar
// başka bilgisayarda da kullanılabilir. Uygulama hiçbir sunucuya bağlanmaz;
// yalnızca File System Access API ile yerel dosya yazar.
import { openDB } from "idb";
import {
  applyProgress,
  exportLibrary,
  exportProgress,
  restoreLibrary,
} from "./storage";

export const LIBRARY_FILE = "odak-kutuphane.json";
export const PROGRESS_FILE = "odak-ilerleme.json";

type Permission = "granted" | "denied" | "prompt";
/** Kullanılan File System Access API yüzeyi (TypeScript DOM tiplerinde eksik). */
export interface FolderHandle {
  name: string;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<{
    getFile(): Promise<{ text(): Promise<string> }>;
    createWritable(): Promise<{
      write(data: string): Promise<void>;
      close(): Promise<void>;
    }>;
  }>;
  queryPermission?(options: { mode: "readwrite" }): Promise<Permission>;
  requestPermission?(options: { mode: "readwrite" }): Promise<Permission>;
}

export const folderSupported = () =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

// Klasör tanıtıcısı, kütüphane veritabanının şemasına dokunmamak için ayrı tutulur.
const handles = () =>
  openDB("odak-kayit-klasoru", 1, {
    upgrade(db) {
      db.createObjectStore("handles");
    },
  });
export async function savedFolder(): Promise<FolderHandle | undefined> {
  try {
    return await (await handles()).get("handles", "main");
  } catch {
    return undefined;
  }
}
export async function rememberFolder(handle: FolderHandle | undefined) {
  const db = await handles();
  if (handle) await db.put("handles", handle, "main");
  else await db.delete("handles", "main");
}
export async function pickFolder(): Promise<FolderHandle> {
  const picker = (
    window as unknown as {
      showDirectoryPicker(options: {
        id: string;
        mode: "readwrite";
      }): Promise<FolderHandle>;
    }
  ).showDirectoryPicker;
  return picker({ id: "odak-kayit", mode: "readwrite" });
}
/** İzin durumu; `ask` yalnızca kullanıcı tıklamasından çağrılabilir. */
export async function permission(
  handle: FolderHandle,
  ask = false,
): Promise<Permission> {
  const options = { mode: "readwrite" } as const;
  let state = (await handle.queryPermission?.(options)) ?? "granted";
  if (state === "prompt" && ask)
    state = (await handle.requestPermission?.(options)) ?? "granted";
  return state;
}

async function read(handle: FolderHandle, name: string): Promise<unknown> {
  try {
    const file = await (await handle.getFileHandle(name)).getFile();
    const text = await file.text();
    return text.trim() ? JSON.parse(text) : undefined;
  } catch (error) {
    if ((error as Error).name === "NotFoundError") return undefined;
    if (error instanceof SyntaxError) return undefined; // yarım yazılmış dosya
    throw error;
  }
}
async function write(handle: FolderHandle, name: string, value: unknown) {
  const writable = await (
    await handle.getFileHandle(name, { create: true })
  ).createWritable();
  await writable.write(JSON.stringify(value));
  await writable.close();
}

/**
 * Klasördeki kayıtları bu tarayıcıya alır: eksik belgeleri ekler, daha yeni
 * okuma konumlarını uygular. Var olan belgeler ve daha güncel konumlar korunur.
 */
export async function pull(handle: FolderHandle) {
  const library = await read(handle, LIBRARY_FILE);
  const added = library ? await restoreLibrary(library) : 0;
  const updated = await applyProgress(await read(handle, PROGRESS_FILE));
  return { added, updated, hasLibrary: Boolean(library) };
}
/** Bu tarayıcıdaki durumu klasöre yazar. `full` belge içeriklerini de yazar. */
export async function push(handle: FolderHandle, full: boolean) {
  if (full) await write(handle, LIBRARY_FILE, await exportLibrary());
  await write(handle, PROGRESS_FILE, await exportProgress());
}
