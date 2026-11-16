import { useCallback, useEffect, useRef, useState } from "react";
import {
  PanelLeft,
  Plus,
  Upload,
  Clipboard,
  X,
  AlertCircle,
  Check,
  BookOpen,
  WifiOff,
  FolderSync,
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { Reader } from "./components/Reader";
import { ImportDialog, type ImportTab } from "./components/ImportDialog";
import { Statistics } from "./components/Statistics";
import { Settings } from "./components/Settings";
import { IconButton, Modal } from "./components/primitives";
import * as storage from "./core/storage";
import * as folderSync from "./core/folder";
import {
  defaultSettings,
  metadata,
  type Book,
  type BookMetadata,
  type Preferences,
  type Progress,
  type Settings as SettingsValue,
  type ImportedDocument,
  type ReadingTotals,
} from "./core/types";
import { importFile, importText } from "./import";

export interface FolderStatus {
  name: string;
  /** locked: klasör hatırlanıyor ama bu oturumda izin verilmesi gerekiyor */
  state: "connected" | "locked";
  savedAt?: number;
  error?: string;
}

export default function App() {
  const [books, setBooks] = useState<BookMetadata[]>([]);
  const [book, setBook] = useState<Book>();
  const [settings, setSettings] = useState<SettingsValue>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState("");
  const [sidebar, setSidebar] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dialog, setDialog] = useState<"import" | "stats" | "settings">();
  const [importTab, setImportTab] = useState<ImportTab>("files");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [importError, setImportError] = useState("");
  const [deleting, setDeleting] = useState<BookMetadata>();
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean }>();
  const [online, setOnline] = useState(navigator.onLine);
  const [update, setUpdate] = useState<ServiceWorker>();
  const [lifetime, setLifetime] = useState<ReadingTotals>({
    words: 0,
    seconds: 0,
  });
  const bookRef = useRef(book);
  const settingsRef = useRef(settings);
  const busyRef = useRef(false);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const openRequest = useRef(0);
  const dragDepth = useRef(0);
  const [folder, setFolder] = useState<FolderStatus>();
  const [settingsTab, setSettingsTab] = useState<"reading" | "library">(
    "reading",
  );
  const [epoch, setEpoch] = useState(0);
  const folderRef = useRef<folderSync.FolderHandle>(undefined);
  const lockedFolder = useRef<folderSync.FolderHandle>(undefined);
  const syncTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const syncFull = useRef(false);
  const syncing = useRef<Promise<unknown>>(Promise.resolve());
  settingsRef.current = settings;
  // Kayıt klasörüne yazma: belge kümesi değişince tam, aksi halde yalnızca ilerleme.
  const flushSync = useCallback(() => {
    clearTimeout(syncTimer.current);
    syncTimer.current = undefined;
    const handle = folderRef.current;
    if (!handle) return syncing.current;
    const full = syncFull.current;
    syncFull.current = false;
    syncing.current = syncing.current
      .catch(() => {})
      .then(() => saveQueue.current)
      .catch(() => {})
      .then(() => folderSync.push(handle, full))
      .then(
        () =>
          setFolder(
            (f) => f && { ...f, savedAt: Date.now(), error: undefined },
          ),
        (e) => {
          if (full) syncFull.current = true;
          setFolder(
            (f) =>
              f && {
                ...f,
                error: e instanceof Error ? e.message : "Klasöre yazılamadı.",
              },
          );
        },
      );
    return syncing.current;
  }, []);
  const scheduleSync = useCallback(
    (full = false) => {
      if (full) syncFull.current = true;
      if (!folderRef.current) return;
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(flushSync, full ? 300 : 2500);
    },
    [flushSync],
  );
  const notify = useCallback((message: string, error = false) => {
    clearTimeout(toastTimer.current);
    setToast({ message, error });
    if (!error)
      toastTimer.current = setTimeout(() => setToast(undefined), 4500);
  }, []);
  const reportError = useCallback(
    (e: unknown) =>
      notify(e instanceof Error ? e.message : "Bu işlem tamamlanamadı.", true),
    [notify],
  );
  const reloadBooks = useCallback(
    async () => setBooks(await storage.loadLibrary()),
    [],
  );
  const updateSettings = useCallback(
    (value: SettingsValue) => {
      settingsRef.current = value;
      setSettings(value);
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => storage.saveSettings(value))
        .catch(reportError);
      scheduleSync();
    },
    [reportError, scheduleSync],
  );
  const updateMetadata = useCallback(
    (value: Book) =>
      setBooks((old) =>
        old
          .map((b) => (b.id === value.id ? metadata(value) : b))
          .sort(
            (a, b) =>
              (b.lastReadAt ?? b.importedAt) - (a.lastReadAt ?? a.importedAt),
          ),
      ),
    [],
  );
  const persistBook = useCallback(
    (value: Book, render = false) => {
      if (bookRef.current?.id === value.id) {
        bookRef.current = value;
        if (render) setBook(value);
      }
      updateMetadata(value);
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => storage.saveBook(value))
        .catch(reportError);
      scheduleSync();
    },
    [updateMetadata, reportError, scheduleSync],
  );
  const progress = useCallback(
    (id: string, p: Progress, preferences: Preferences) => {
      const active = bookRef.current;
      if (active?.id === id)
        persistBook({
          ...active,
          progress: p,
          preferences,
          lastReadAt: Date.now(),
        });
    },
    [persistBook],
  );
  const segment = useCallback(
    (words: number, seconds: number, startedAt: number) => {
      if (words <= 0 || seconds <= 0 || !Number.isFinite(seconds)) return;
      setLifetime((old) => ({
        words: old.words + words,
        seconds: old.seconds + seconds,
      }));
      const active = bookRef.current;
      if (active)
        persistBook(
          {
            ...active,
            stats: {
              words: (active.stats?.words ?? 0) + words,
              seconds: (active.stats?.seconds ?? 0) + seconds,
            },
          },
          true,
        );
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => storage.recordStats(words, seconds, startedAt))
        .catch(reportError);
    },
    [reportError, persistBook],
  );
  const openBook = useCallback(
    async (id: string) => {
      const request = ++openRequest.current;
      try {
        // Pause the outgoing reader before loading another document.
        window.dispatchEvent(new Event("odak:pause"));
        await saveQueue.current;
        const value = await storage.loadBook(id);
        if (request !== openRequest.current) return;
        value.lastReadAt = Date.now();
        bookRef.current = value;
        setBook(value);
        persistBook(value);
        updateSettings({ ...settingsRef.current, selectedID: id });
        setMobileOpen(false);
      } catch (e) {
        reportError(e);
      }
    },
    [persistBook, updateSettings, reportError],
  );
  // Tarayıcı deposundaki her şeyi ekrana yükler (açılışta ve klasörden alımdan sonra).
  const loadAll = useCallback(async () => {
    const [library, prefs, stats] = await Promise.all([
      storage.loadLibrary(),
      storage.loadSettings(),
      storage.loadStats().catch(() => []),
    ]);
    setLifetime(
      stats.reduce(
        (sum, d) => ({
          words: sum.words + d.words,
          seconds: sum.seconds + d.seconds,
        }),
        { words: 0, seconds: 0 },
      ),
    );
    setBooks(library);
    setSettings(prefs);
    settingsRef.current = prefs;
    const wanted = bookRef.current?.id ?? prefs.selectedID;
    const id = library.some((b) => b.id === wanted) ? wanted : library[0]?.id;
    const value = id ? await storage.loadBook(id) : undefined;
    bookRef.current = value;
    setBook(value);
    setEpoch((n) => n + 1);
  }, []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const handle = folderSync.folderSupported()
          ? await folderSync.savedFolder()
          : undefined;
        if (handle) {
          if ((await folderSync.permission(handle)) === "granted") {
            const result = await folderSync.pull(handle);
            folderRef.current = handle;
            if (alive) setFolder({ name: handle.name, state: "connected" });
            // Klasörde kütüphane dosyası yoksa ilk yazım tam olur.
            syncFull.current = !result.hasLibrary;
          } else {
            lockedFolder.current = handle;
            if (alive) setFolder({ name: handle.name, state: "locked" });
          }
        }
      } catch (e) {
        if (alive)
          notify(
            `Kayıt klasörü okunamadı: ${e instanceof Error ? e.message : e}`,
            true,
          );
      }
      try {
        await loadAll();
        if (folderRef.current) scheduleSync();
      } catch (e) {
        if (alive) setFatal((e as Error).message);
      }
      if (alive) setReady(true);
    })();
    const flush = () => {
      if (document.visibilityState === "hidden" && syncTimer.current)
        void flushSync();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      alive = false;
      clearTimeout(toastTimer.current);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, []);
  const connectFolder = useCallback(
    async (choose: boolean) => {
      try {
        const handle =
          !choose && lockedFolder.current
            ? lockedFolder.current
            : await folderSync.pickFolder();
        if ((await folderSync.permission(handle, true)) !== "granted") {
          notify("Klasöre yazma izni verilmedi.", true);
          return;
        }
        window.dispatchEvent(new Event("odak:pause"));
        await saveQueue.current;
        await folderSync.rememberFolder(handle);
        const result = await folderSync.pull(handle);
        folderRef.current = handle;
        lockedFolder.current = undefined;
        setFolder({ name: handle.name, state: "connected" });
        await loadAll();
        syncFull.current = true;
        await flushSync();
        notify(
          result.added || result.updated
            ? `Kayıt klasörü bağlandı: ${result.added} belge geri yüklendi, ${result.updated} okuma konumu güncellendi.`
            : `Kayıt klasörü bağlandı: "${handle.name}". Kütüphane ve ilerleme artık buraya da kaydediliyor.`,
        );
      } catch (e) {
        if ((e as Error).name !== "AbortError") reportError(e);
      }
    },
    [loadAll, flushSync, notify, reportError],
  );
  const disconnectFolder = useCallback(async () => {
    await flushSync();
    folderRef.current = undefined;
    lockedFolder.current = undefined;
    setFolder(undefined);
    await folderSync.rememberFolder(undefined).catch(() => {});
    notify("Kayıt klasörü bağlantısı kesildi. Klasördeki dosyalar silinmedi.");
  }, [flushSync, notify]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);
  useEffect(() => {
    const network = () => setOnline(navigator.onLine);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("./sw.js")
        .then((registration) => {
          if (registration.waiting) setUpdate(registration.waiting);
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setUpdate(worker);
            });
          });
        })
        .catch(() => {
          /* Online reading works when service workers are unavailable. */
        });
    return () => {
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, []);
  const showImport = useCallback((tab: ImportTab = "files") => {
    window.dispatchEvent(new Event("odak:pause"));
    setImportTab(tab);
    setImportError("");
    setDialog("import");
  }, []);
  const beginImport = () => {
    if (busyRef.current || fatal) return false;
    busyRef.current = true;
    setBusy(true);
    setImportError("");
    return true;
  };
  const finishImport = () => {
    busyRef.current = false;
    setBusy(false);
    setStatus("");
  };
  const addDocument = async (doc: ImportedDocument) => {
    const result = await storage.importDocument(doc, settingsRef.current);
    await reloadBooks();
    await openBook(result.book.id);
    if (!result.duplicate) scheduleSync(true);
    return result.duplicate;
  };
  const files = async (values: File[]) => {
    if (!beginImport()) return;
    window.dispatchEvent(new Event("odak:pause"));
    let imported = 0,
      duplicates = 0;
    const errors: string[] = [];
    for (const file of values) {
      try {
        const doc = await importFile(file, setStatus, {
          footnotes: settingsRef.current.stripFootnotes,
        });
        const duplicate = await addDocument(doc);
        imported++;
        if (duplicate) duplicates++;
      } catch (e) {
        errors.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    finishImport();
    if (errors.length) {
      setImportError(errors.join("\n"));
      setDialog("import");
      if (imported)
        notify(
          `${imported} belge eklendi. ${errors.length} belge içe aktarılamadı.`,
          true,
        );
    } else {
      setDialog(undefined);
      notify(
        duplicates === imported
          ? "Zaten kütüphanenizde. İlerlemeniz korundu."
          : `${imported} belge kütüphanenize eklendi.`,
      );
    }
  };
  const text = async (value: string, title?: string) => {
    if (!beginImport()) return;
    try {
      const duplicate = await addDocument(importText(value, title));
      setDialog(undefined);
      notify(
        duplicate
          ? "Zaten kütüphanenizde. İlerlemeniz korundu."
          : "Metin kütüphanenize eklendi.",
      );
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      finishImport();
    }
  };
  const favorite = async (id: string) => {
    try {
      const value =
        bookRef.current?.id === id
          ? bookRef.current
          : await storage.loadBook(id);
      persistBook({ ...value, isFavorite: !value.isFavorite }, true);
    } catch (e) {
      reportError(e);
    }
  };
  const deleteSelected = async () => {
    if (!deleting) return;
    try {
      if (bookRef.current?.id === deleting.id) {
        window.dispatchEvent(new Event("odak:pause"));
        await saveQueue.current;
        ++openRequest.current;
        bookRef.current = undefined;
        setBook(undefined);
      }
      await storage.deleteBook(deleting.id);
      const library = await storage.loadLibrary();
      setBooks(library);
      if (settingsRef.current.selectedID === deleting.id) {
        updateSettings({ ...settingsRef.current, selectedID: undefined });
        if (library[0]) await openBook(library[0].id);
      }
      setDeleting(undefined);
      scheduleSync(true);
      notify("Belge silindi.");
    } catch (e) {
      reportError(e);
    }
  };
  const restore = async (file: File) => {
    try {
      if (file.size > 250 * 1024 * 1024)
        throw new Error("250 MB'tan küçük bir yedek dosyası seçin.");
      const n = await storage.restoreLibrary(JSON.parse(await file.text()));
      const restoredSettings = await storage.loadSettings();
      updateSettings(restoredSettings);
      await reloadBooks();
      if (!bookRef.current) {
        const library = await storage.loadLibrary();
        if (library[0]) await openBook(library[0].id);
      }
      scheduleSync(true);
      notify(`${n} belge geri yüklendi. Mevcut ilerleme korundu.`);
    } catch (e) {
      reportError(e);
      throw e;
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || document.querySelector("dialog[open]"))
        return;
      if (e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileInput.current?.click();
      }
      if (e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        showImport("text");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [showImport]);
  const showLibrary = () => {
    if (window.innerWidth <= 800) setMobileOpen(!mobileOpen);
    else setSidebar(!sidebar);
  };
  const closeImport = () => {
    setDialog(undefined);
  };
  return (
    <div
      className={`app ${sidebar ? "" : "sidebar-hidden"}`}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          dragDepth.current--;
          if (dragDepth.current <= 0) setDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (e.dataTransfer.files.length && !busyRef.current) {
          setImportTab("files");
          setDialog("import");
          void files([...e.dataTransfer.files]);
        }
      }}
    >
      <input
        ref={fileInput}
        type="file"
        accept=".epub,.pdf,.docx,.rtf,.html,.htm,.xhtml,.md,.markdown,.txt,.text"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) {
            setImportTab("files");
            setDialog("import");
            void files([...e.target.files]);
          }
          e.target.value = "";
        }}
      />
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Kütüphaneyi kapat"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <Sidebar
        books={books}
        selectedID={book?.id}
        onSelect={(id) => void openBook(id)}
        onImport={() => showImport()}
        onStats={async () => {
          window.dispatchEvent(new Event("odak:pause"));
          await saveQueue.current;
          setDialog("stats");
        }}
        onSettings={() => {
          window.dispatchEvent(new Event("odak:pause"));
          setSettingsTab("reading");
          setDialog("settings");
        }}
        storage={
          folder?.error
            ? {
                label: "Klasöre yazılamadı",
                title: folder.error,
                tone: "warn",
              }
            : folder?.state === "connected"
              ? {
                  label: folder.name
                    ? `Klasöre kaydediliyor: ${folder.name}`
                    : "Klasöre kaydediliyor",
                  title:
                    "Kütüphane ve okuma konumu bu klasöre de otomatik kaydediliyor. Ayarlar için tıklayın.",
                  tone: "ok",
                }
              : folder
                ? {
                    label: "Kayıt klasörü için izin gerekiyor",
                    title: `"${folder.name}" klasörüne bu oturumda izin verilmedi. Bağlanmak için tıklayın.`,
                    tone: "warn",
                  }
                : folderSync.folderSupported()
                  ? {
                      label: "Yalnızca bu tarayıcıda. Klasör bağlayın",
                      title:
                        "Tarayıcı verileri silinirse kütüphane ve okuma konumu kaybolur. Kalıcı kayıt klasörü bağlamak için tıklayın.",
                      tone: "warn",
                    }
                  : {
                      label: "Bu cihazda kayıtlı",
                      title:
                        "Bu tarayıcı klasöre kaydetmeyi desteklemiyor. Yedek almak için tıklayın.",
                      tone: "plain",
                    }
        }
        onStorage={() => {
          window.dispatchEvent(new Event("odak:pause"));
          setSettingsTab("library");
          setDialog("settings");
        }}
        onFavorite={(id) => void favorite(id)}
        onDelete={(id) => {
          window.dispatchEvent(new Event("odak:pause"));
          setDeleting(books.find((b) => b.id === id));
        }}
        onHide={showLibrary}
        mobileOpen={mobileOpen}
      />
      {book && !fatal ? (
        <Reader
          key={`${book.id}:${epoch}`}
          book={book}
          mode={settings.mode}
          onMode={(mode) => updateSettings({ ...settingsRef.current, mode })}
          theme={settings.theme}
          onTheme={(theme) => updateSettings({ ...settingsRef.current, theme })}
          onProgress={progress}
          onSegment={segment}
          onNotes={(notes) => {
            if (bookRef.current)
              persistBook({ ...bookRef.current, notes }, true);
          }}
          onFavorite={() => void favorite(book.id)}
          onLibrary={showLibrary}
          lifetime={lifetime}
        />
      ) : (
        <main className="empty-reader">
          <header className="reader-header">
            <IconButton label="Kütüphaneyi göster" onClick={showLibrary}>
              <PanelLeft size={20} />
            </IconButton>
            <span className="empty-header-title">Okuma alanınız</span>
          </header>
          <div className="welcome">
            <img className="welcome-icon" src="./icon.png" alt="Odak Okuyucu" />
            <h1>
              {fatal
                ? "Kütüphanenizde bir sorun var"
                : ready
                  ? "Biraz daha odak."
                  : "Kütüphaneniz açılıyor"}
            </h1>
            <p>
              {fatal ||
                (ready
                  ? "Makaleleriniz, kitaplarınız ve hukuk metinleriniz.\nKelime kelime, kendi hızınızda."
                  : "Bu tarayıcıdaki kayıtlı belgeler okunuyor.")}
            </p>
            {ready && !fatal && (
              <>
                <button
                  type="button"
                  className="button primary welcome-add"
                  onClick={() => showImport()}
                >
                  <Plus size={18} />
                  Belge ekle
                </button>
                <div className="welcome-actions">
                  <button type="button" onClick={() => showImport("files")}>
                    <Upload size={15} />
                    Dosya içe aktar
                  </button>
                  <button type="button" onClick={() => showImport("text")}>
                    <Clipboard size={15} />
                    Metin yapıştır
                  </button>
                </div>
                <span className="welcome-formats">
                  PDF, EPUB, Markdown, metin, Word, RTF ve HTML
                </span>
                {folderSync.folderSupported() && !folder && (
                  <button
                    type="button"
                    className="button welcome-restore"
                    onClick={() => void connectFolder(true)}
                  >
                    <FolderSync size={16} />
                    Kayıt klasöründen geri yükle
                  </button>
                )}
              </>
            )}
            {fatal && (
              <button
                type="button"
                className="button"
                onClick={() => setDialog("settings")}
              >
                Yedekleme ayarlarını aç
              </button>
            )}
          </div>
          <footer className="welcome-footer">
            <BookOpen size={15} />
            <span>
              Tamamen yerel kütüphane. Hesap gerekmez, hiçbir şey sunucuya
              gönderilmez.
            </span>
          </footer>
        </main>
      )}
      {folder?.state === "locked" && (
        <div className="update-banner folder-banner" role="status">
          <FolderSync size={15} />
          <span>
            Kayıt klasörü "{folder.name}" için bu oturumda izin gerekiyor.
          </span>
          <button
            type="button"
            className="text-button"
            onClick={() => void connectFolder(false)}
          >
            Bağlan
          </button>
        </div>
      )}
      {folder?.error && (
        <div className="update-banner folder-banner" role="alert">
          <AlertCircle size={15} />
          <span>Kayıt klasörüne yazılamadı: {folder.error}</span>
          <button
            type="button"
            className="text-button"
            onClick={() => void connectFolder(true)}
          >
            Klasörü yeniden seç
          </button>
        </div>
      )}
      {!online && (
        <div className="network-status" role="status">
          <WifiOff size={14} />
          Çevrimdışı. Kayıtlı kütüphaneniz kullanılabilir.
        </div>
      )}
      {busy && dialog !== "import" && (
        <div className="background-import" role="status">
          {status || "Belgeler ekleniyor..."}
        </div>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <IconButton
            label="Bildirimi kapat"
            onClick={() => setToast(undefined)}
          >
            <X size={16} />
          </IconButton>
        </div>
      )}
      {update && (
        <div className="update-banner">
          <span>Yeni sürüm hazır.</span>
          <button
            type="button"
            className="text-button"
            onClick={async () => {
              window.dispatchEvent(new Event("odak:pause"));
              await saveQueue.current;
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                () => location.reload(),
                { once: true },
              );
              update.postMessage("ACTIVATE_UPDATE");
            }}
          >
            Güncelle
          </button>
          <IconButton
            label="Güncellemeyi kapat"
            onClick={() => setUpdate(undefined)}
          >
            <X size={14} />
          </IconButton>
        </div>
      )}
      {dragging && (
        <div className="global-drop">
          <Upload size={42} strokeWidth={1.3} />
          <h2>Kütüphaneye eklemek için bırakın</h2>
        </div>
      )}
      {dialog === "import" && (
        <ImportDialog
          initialTab={importTab}
          onClose={closeImport}
          onFiles={(v) => void files(v)}
          onText={(v, t) => void text(v, t)}
          busy={busy}
          status={status}
          error={importError}
        />
      )}
      {dialog === "stats" && (
        <Statistics onClose={() => setDialog(undefined)} />
      )}
      {dialog === "settings" && (
        <Settings
          value={settings}
          onChange={updateSettings}
          onClose={() => setDialog(undefined)}
          onRestore={restore}
          onError={reportError}
          folder={folder}
          onConnectFolder={(choose) => void connectFolder(choose)}
          onDisconnectFolder={() => void disconnectFolder()}
          initialTab={settingsTab}
          onSaveFolder={() => {
            syncFull.current = true;
            void flushSync();
          }}
        />
      )}
      {deleting && (
        <Modal
          title="Belge silinsin mi?"
          className="delete-modal"
          onClose={() => setDeleting(undefined)}
          footer={
            <>
              <button
                type="button"
                className="button"
                onClick={() => setDeleting(undefined)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => void deleteSelected()}
              >
                Sil
              </button>
            </>
          }
        >
          <p>
            <strong>{deleting.title}</strong>, okuma ilerlemesi ve notlarıyla
            birlikte kütüphaneden kaldırılacak. Bilgisayarınızdaki özgün dosya
            silinmez.
          </p>
        </Modal>
      )}
    </div>
  );
}
