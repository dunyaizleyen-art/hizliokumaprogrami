import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { defaultSettings } from "../src/core/types";
import { importText } from "../src/import";
import {
  applyProgress,
  deleteBook,
  exportProgress,
  importDocument,
  loadBook,
  loadLibrary,
  recordStats,
  loadStats,
  saveBook,
} from "../src/core/storage";
import {
  LIBRARY_FILE,
  PROGRESS_FILE,
  pull,
  push,
  type FolderHandle,
} from "../src/core/folder";

/** Bellekte tutulan sahte klasör. */
function memoryFolder() {
  const files = new Map<string, string>();
  const handle: FolderHandle = {
    name: "Odak Kayıt",
    async getFileHandle(name, options) {
      if (!files.has(name) && !options?.create)
        throw Object.assign(new Error("yok"), { name: "NotFoundError" });
      return {
        getFile: async () => ({ text: async () => files.get(name) ?? "" }),
        createWritable: async () => {
          let data = "";
          return {
            write: async (chunk: string) => void (data += chunk),
            close: async () => void files.set(name, data),
          };
        },
      };
    },
  };
  return { files, handle };
}
const TEXT =
  "Kalıcı kayıt denemesi için yazılmış, yeterince uzun ve benzersiz bir Türkçe metin. İkinci cümle de burada duruyor.";

describe("kalıcı kayıt klasörü", () => {
  it("tarayıcı verisi silinince belgeyi ve okuma konumunu klasörden geri getirir", async () => {
    const { files, handle } = memoryFolder();
    const { book } = await importDocument(
      importText(TEXT, "Klasör denemesi"),
      defaultSettings,
    );
    await saveBook({
      ...book,
      progress: { sectionIndex: 0, wordIndex: 3 },
      lastReadAt: 1000,
    });
    await push(handle, true);
    // Okumaya devam: yalnızca küçük ilerleme dosyası yazılır.
    await saveBook({
      ...book,
      progress: { sectionIndex: 0, wordIndex: 9 },
      lastReadAt: 2000,
      notes: [
        { id: "n", text: "not", sectionIndex: 0, wordIndex: 9, createdAt: 1 },
      ],
    });
    await recordStats(120, 30, Date.now());
    await push(handle, false);
    expect([...files.keys()].sort()).toEqual([PROGRESS_FILE, LIBRARY_FILE]);
    expect(files.get(PROGRESS_FILE)).not.toContain("benzersiz");

    // Chrome kapanınca site verileri silindi.
    await deleteBook(book.id);
    expect(
      (await loadLibrary()).some((b) => b.title === "Klasör denemesi"),
    ).toBe(false);

    const result = await pull(handle);
    expect(result.added).toBe(1);
    expect(result.hasLibrary).toBe(true);
    const restored = (await loadLibrary()).find(
      (b) => b.title === "Klasör denemesi",
    )!;
    expect(restored.progress).toEqual({ sectionIndex: 0, wordIndex: 9 });
    expect(restored.notes).toHaveLength(1);
    expect((await loadBook(restored.id)).sections[0].text).toContain(
      "benzersiz",
    );
    expect((await loadStats()).reduce((n, d) => n + d.words, 0)).toBe(120);
  });
  it("daha güncel yerel konumu klasördeki eski kayıtla ezmez", async () => {
    const { book } = await importDocument(
      importText(TEXT + " Üçüncü cümle farklı.", "Yenilik denemesi"),
      defaultSettings,
    );
    await saveBook({
      ...book,
      progress: { sectionIndex: 0, wordIndex: 4 },
      lastReadAt: 5000,
    });
    const old = await exportProgress();
    await saveBook({
      ...book,
      progress: { sectionIndex: 0, wordIndex: 12 },
      lastReadAt: 9000,
    });
    expect(await applyProgress(old)).toBe(0);
    expect((await loadBook(book.id)).progress.wordIndex).toBe(12);
    // Başka cihazdan gelen daha yeni kayıt uygulanır ve sınırlar içinde tutulur.
    old.books[book.fingerprint].lastReadAt = 9500;
    old.books[book.fingerprint].progress = { sectionIndex: 0, wordIndex: 9999 };
    expect(await applyProgress(old)).toBe(1);
    const updated = await loadBook(book.id);
    expect(updated.progress.wordIndex).toBe(updated.sections[0].wordCount);
  });
  it("boş klasörü ve bozuk dosyayı sorunsuz karşılar", async () => {
    const { files, handle } = memoryFolder();
    expect(await pull(handle)).toEqual({
      added: 0,
      updated: 0,
      hasLibrary: false,
    });
    files.set(PROGRESS_FILE, '{"version":1,"app":"Odak Oku');
    expect((await pull(handle)).updated).toBe(0);
    expect(await applyProgress({ app: "Başka" })).toBe(0);
  });
});
