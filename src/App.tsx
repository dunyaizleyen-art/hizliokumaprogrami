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
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { Reader } from "./components/Reader";
import { ImportDialog, type ImportTab } from "./components/ImportDialog";
import { Statistics } from "./components/Statistics";
import { Settings } from "./components/Settings";
import { IconButton, Modal } from "./components/primitives";
import * as storage from "./core/storage";
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
  settingsRef.current = settings;
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
      void storage.saveSettings(value).catch(reportError);
    },
    [reportError],
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
    },
    [updateMetadata, reportError],
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
  useEffect(() => {
    let alive = true;
    void Promise.all([
      storage.loadLibrary(),
      storage.loadSettings(),
      storage.loadStats().catch(() => []),
    ])
      .then(async ([library, prefs, stats]) => {
        if (!alive) return;
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
        const id = library.some((b) => b.id === prefs.selectedID)
          ? prefs.selectedID
          : library[0]?.id;
        if (id) {
          const value = await storage.loadBook(id);
          if (alive) {
            bookRef.current = value;
            setBook(value);
          }
        }
        if (alive) setReady(true);
      })
      .catch((e) => {
        if (alive) {
          setFatal(e.message);
          setReady(true);
        }
      });
    return () => {
      alive = false;
      clearTimeout(toastTimer.current);
    };
  }, []);
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
