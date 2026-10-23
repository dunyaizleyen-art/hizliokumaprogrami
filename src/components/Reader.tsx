import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import {
  PanelLeft,
  List,
  Search,
  Star,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Play,
  Pause,
  SlidersHorizontal,
  Minus,
  Plus,
  Maximize,
  Minimize,
  Check,
  BookOpen,
  RotateCcw,
  X,
} from "lucide-react";
import { ReaderSession } from "../core/session";
import {
  pivot,
  tokenIndexAtOffset,
  type SearchMatch,
  type Token,
} from "../core/text";
import {
  completedWords,
  formatTime,
  MAX_WPM,
  MIN_WPM,
  totalWords,
  wpmOf,
  type Book,
  type ChunkMode,
  type Note,
  type Preferences,
  type Progress,
  type ReadingTotals,
  type Theme,
} from "../core/types";
import { IconButton, Modal } from "./primitives";
import { Options, chunkLabel } from "./Options";

function editable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        'input,textarea,select,button,a,[contenteditable="true"],dialog',
      ),
    )
  );
}
const CHUNK_KEYS: Record<string, ChunkMode> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": "phrase",
};
export function Reader({
  book,
  mode,
  onMode,
  theme,
  onTheme,
  onProgress,
  onSegment,
  onNotes,
  onFavorite,
  onLibrary,
  lifetime,
}: {
  book: Book;
  mode: "rsvp" | "text";
  onMode: (mode: "rsvp" | "text") => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  onProgress: (
    id: string,
    progress: Progress,
    preferences: Preferences,
  ) => void;
  onSegment: (words: number, seconds: number, startedAt: number) => void;
  onNotes: (notes: Note[]) => void;
  onFavorite: () => void;
  onLibrary: () => void;
  /** Tüm belgelerdeki toplam gerçek okuma */
  lifetime: ReadingTotals;
}) {
  const session = useMemo(() => new ReaderSession(book), [book.id]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [panel, setPanel] = useState<
    "chapters" | "search" | "notes" | "options"
  >();
  const [chrome, setChrome] = useState(true);
  const [hud, setHUD] = useState<string>();
  const [fullscreen, setFullscreen] = useState(
    Boolean(document.fullscreenElement),
  );
  const mainRef = useRef<HTMLElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hudTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const controlsRef = useRef<HTMLDivElement>(null);
  const playingRef = useRef(state.playing);
  playingRef.current = state.playing;
  const reveal = () => {
    setChrome(true);
    clearTimeout(hideTimer.current);
    if (
      playingRef.current &&
      !controlsRef.current?.matches(":hover") &&
      !controlsRef.current?.contains(document.activeElement)
    )
      hideTimer.current = setTimeout(() => setChrome(false), 2200);
  };
  useEffect(() => {
    session.onProgress = (progress, preferences) =>
      onProgress(book.id, progress, preferences);
    session.onSegment = onSegment;
  }, [session, book.id, onProgress, onSegment]);
  useEffect(() => {
    const pause = () => session.pause();
    const visibility = () => {
      if (document.hidden) pause();
    };
    const fullscreenChange = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("odak:pause", pause);
    window.addEventListener("pagehide", pause);
    window.addEventListener("beforeunload", pause);
    document.addEventListener("fullscreenchange", fullscreenChange);
    return () => {
      session.dispose();
      clearTimeout(hideTimer.current);
      clearTimeout(hudTimer.current);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("odak:pause", pause);
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("beforeunload", pause);
      document.removeEventListener("fullscreenchange", fullscreenChange);
    };
  }, [session]);
  useEffect(() => {
    reveal();
  }, [state.playing]);
  const openPanel = (value: typeof panel) => {
    session.pause();
    setPanel(value);
  };
  const flash = (message: string) => {
    setHUD(message);
    clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHUD(undefined), 1100);
  };
  const changeSpeed = (delta: number) => {
    session.setPreferences({
      wordsPerMinute: state.preferences.wordsPerMinute + delta,
    });
    flash(`${session.getSnapshot().preferences.wordsPerMinute} WPM`);
    reveal();
  };
  const fullscreenToggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await mainRef.current?.requestFullscreen();
    } catch {
      /* Tarayıcı gömülü görünümde tam ekrana izin vermeyebilir. */
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openPanel("search");
        return;
      }
      if (editable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        session.toggle();
        reveal();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey) {
          session.sentenceBack();
          flash("1 cümle geri");
        } else session.step(false);
        reveal();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey) {
          session.sentenceForward();
          flash("1 cümle ileri");
        } else session.step(true);
        reveal();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        changeSpeed(e.shiftKey ? 100 : 25);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        changeSpeed(e.shiftKey ? -100 : -25);
      } else if (!e.shiftKey && e.key in CHUNK_KEYS) {
        e.preventDefault();
        const chunkMode = CHUNK_KEYS[e.key];
        session.setPreferences({ chunkMode });
        flash(chunkLabel(chunkMode));
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        void fullscreenToggle();
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        const contextOnPause = !state.preferences.contextOnPause;
        session.setPreferences({ contextOnPause });
        flash(
          contextOnPause ? "Bağlam görünümü açık" : "Bağlam görünümü kapalı",
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const current = book.sections[state.sectionIndex];
  const tokens = session.tokens();
  const count = totalWords(book);
  const complete = completedWords({ ...book, progress: state });
  const percentage = count ? Math.round((complete / count) * 100) : 0;
  const remaining = session.remaining();
  const words = session.displayWords;
  const displayEnd = session.displayEnd;
  const word = words.join(" ");
  const [prefix, center, suffix] = pivot(word);
  const contextBefore = tokens
    .slice(Math.max(0, session.displayIndex - 6), session.displayIndex)
    .map((t) => t.text)
    .join(" ");
  const contextAfter = tokens
    .slice(displayEnd, displayEnd + 6)
    .map((t) => t.text)
    .join(" ");
  const showContext =
    state.preferences.showContext &&
    !(state.preferences.focusMode && state.playing);
  const live = session.liveSession();
  const sessionWpm = wpmOf(live);
  const bookWpm = wpmOf({
    words: (book.stats?.words ?? 0) + live.words,
    seconds: (book.stats?.seconds ?? 0) + live.seconds,
  });
  const lifetimeWpm = wpmOf({
    words: lifetime.words + live.words,
    seconds: lifetime.seconds + live.seconds,
  });
  const pausedContext =
    mode === "rsvp" &&
    !state.playing &&
    state.preferences.contextOnPause &&
    tokens.length > 0 &&
    !session.atEnd;
  return (
    <main
      ref={mainRef}
      className={`reader ${state.playing ? "is-playing" : ""} ${fullscreen ? "is-fullscreen" : ""}`}
      onPointerMove={reveal}
      onTouchStart={reveal}
    >
      <header className="reader-header">
        <IconButton label="Kütüphaneyi göster" onClick={onLibrary}>
          <PanelLeft size={20} />
        </IconButton>
        <div className="document-heading">
          <h1 title={book.title}>{book.title}</h1>
          <span title={current?.title}>
            {current?.title}
            <span className="heading-progress">%{percentage}</span>
          </span>
        </div>
        <div
          className="segmented reader-modes"
          role="group"
          aria-label="Okuma modu"
        >
          <button
            type="button"
            aria-pressed={mode === "rsvp"}
            onClick={() => {
              session.pause();
              onMode("rsvp");
            }}
          >
            RSVP
          </button>
          <button
            type="button"
            aria-pressed={mode === "text"}
            onClick={() => {
              session.pause();
              onMode("text");
            }}
          >
            Metin
          </button>
        </div>
        <div className="reader-tools">
          <IconButton label="Bölümler" onClick={() => openPanel("chapters")}>
            <List size={21} />
          </IconButton>
          <IconButton
            label="Belgede ara (Ctrl+F)"
            onClick={() => openPanel("search")}
          >
            <Search size={20} />
          </IconButton>
          <IconButton
            label={book.isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
            aria-pressed={book.isFavorite}
            className={book.isFavorite ? "active" : ""}
            onClick={onFavorite}
          >
            <Star size={21} fill={book.isFavorite ? "currentColor" : "none"} />
          </IconButton>
          <IconButton label="Notlar" onClick={() => openPanel("notes")}>
            <StickyNote size={20} />
            {book.notes.length > 0 && <span className="note-dot" />}
          </IconButton>
        </div>
      </header>
      <div
        className={`reading-stage ${mode === "text" || pausedContext ? "text-stage" : ""}`}
      >
        {hud !== undefined && (
          <div className="speed-hud" role="status">
            {hud}
          </div>
        )}
        {pausedContext ? (
          <>
            <p className="paused-hint">
              Duraklatıldı. Bir kelimeye tıklayın, oradan devam etmek için{" "}
              <kbd>Space</kbd> tuşuna basın. <kbd>Shift</kbd>+<kbd>←</kbd> 1
              cümle geri, <kbd>C</kbd> bu görünümü kapatır.
            </p>
            <FullText
              text={current?.text ?? ""}
              tokens={tokens}
              index={session.displayIndex}
              end={displayEnd}
              playing={false}
              title={current?.title ?? ""}
              onSeek={(index) => session.seek(state.sectionIndex, index)}
            />
          </>
        ) : mode === "rsvp" ? (
          <div
            className="rsvp-stage"
            onClick={(e) => {
              if (
                e.target instanceof HTMLElement &&
                !e.target.closest("button")
              ) {
                session.toggle();
                reveal();
              }
            }}
          >
            <div
              className="focus-word-area"
              aria-label={`${state.playing ? "Okunuyor" : "Geçerli kelime"}: ${word}`}
            >
              <div className="focus-guide top" />
              <div
                className="rsvp-word"
                style={
                  {
                    "--word-size": `${state.preferences.fontSize}px`,
                    // Odak harfi ortada sabit: genişlik, uzun olan tarafın iki katı kadar olmalı.
                    "--fit-chars": Math.max(
                      9,
                      1.25 *
                        Math.max(
                          Array.from(prefix).length,
                          Array.from(suffix).length,
                        ) +
                        1,
                    ),
                  } as CSSProperties
                }
                aria-hidden="true"
              >
                <span className="word-prefix">{prefix}</span>
                <span className="word-pivot">{center}</span>
                <span className="word-suffix">{suffix}</span>
              </div>
              <div className="focus-guide bottom" />
            </div>
            <div
              className={`context-line ${showContext ? "" : "hidden"}`}
              aria-hidden="true"
            >
              <span>{contextBefore}</span>
              <strong>{word}</strong>
              <span>{contextAfter}</span>
            </div>
            {session.atEnd && !state.playing && (
              <div className="reading-complete">
                <Check size={17} />
                <span>Belge bitti</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => session.seek(0, 0)}
                >
                  <RotateCcw size={14} />
                  Baştan oku
                </button>
              </div>
            )}
          </div>
        ) : (
          <FullText
            text={current?.text ?? ""}
            tokens={tokens}
            index={session.displayIndex}
            end={displayEnd}
            playing={state.playing}
            title={current?.title ?? ""}
            onSeek={(index) => session.seek(state.sectionIndex, index)}
          />
        )}
      </div>
      <div
        className={`controls-area ${chrome ? "" : "chrome-hidden"}`}
        onFocusCapture={reveal}
        onMouseEnter={() => {
          clearTimeout(hideTimer.current);
          setChrome(true);
        }}
        onMouseLeave={reveal}
      >
        <div className="reader-controls" ref={controlsRef}>
          <div className="playback-buttons">
            <IconButton
              label="1 cümle geri (Shift+←)"
              onClick={() => session.sentenceBack()}
              disabled={state.sectionIndex === 0 && state.wordIndex === 0}
            >
              <ChevronsLeft size={20} />
            </IconButton>
            <IconButton
              label="Önceki grup (←)"
              onClick={() => session.step(false)}
              disabled={state.sectionIndex === 0 && state.wordIndex === 0}
            >
              <ChevronLeft size={22} />
            </IconButton>
            <button
              type="button"
              className="play-button"
              aria-label={
                state.playing
                  ? "Duraklat"
                  : session.atEnd
                    ? "Baştan oku"
                    : "Okumaya başla"
              }
              title={state.playing ? "Duraklat (Space)" : "Başlat (Space)"}
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                session.toggle();
                reveal();
              }}
            >
              {state.playing ? (
                <Pause size={21} fill="currentColor" />
              ) : (
                <Play size={21} fill="currentColor" />
              )}
            </button>
            <IconButton
              label="Sonraki grup (→)"
              onClick={() => session.step(true)}
              disabled={session.atEnd}
            >
              <ChevronRight size={22} />
            </IconButton>
          </div>
          <span className="control-divider" />
          <div className="speed-control">
            <IconButton
              label="Hızı azalt (↓)"
              disabled={state.preferences.wordsPerMinute <= MIN_WPM}
              onClick={() => changeSpeed(-25)}
            >
              <Minus size={14} />
            </IconButton>
            <label className="speed-value">
              <input
                aria-label="Okuma hızı (kelime/dakika)"
                type="number"
                min={MIN_WPM}
                max={MAX_WPM}
                step="25"
                value={state.preferences.wordsPerMinute}
                onChange={(e) => {
                  if (e.target.value)
                    session.setPreferences({
                      wordsPerMinute: Number(e.target.value),
                    });
                }}
              />
              <span>WPM</span>
            </label>
            <IconButton
              label="Hızı artır (↑)"
              disabled={state.preferences.wordsPerMinute >= MAX_WPM}
              onClick={() => changeSpeed(25)}
            >
              <Plus size={14} />
            </IconButton>
          </div>
          <div
            className="segmented compact chunk-control"
            role="group"
            aria-label="Grup boyutu"
          >
            {([1, 2, 3, "phrase"] as ChunkMode[]).map((m, i) => (
              <button
                type="button"
                key={String(m)}
                title={`${chunkLabel(m)} (${i + 1})`}
                aria-pressed={state.preferences.chunkMode === m}
                onClick={() => session.setPreferences({ chunkMode: m })}
              >
                {m === "phrase" ? "Öbek" : m}
              </button>
            ))}
          </div>
          <span className="control-divider progress-divider" />
          <div className="seek-control">
            <input
              aria-label="Bölüm ilerlemesi"
              type="range"
              min="0"
              max={Math.max(0, tokens.length - 1)}
              value={session.displayIndex}
              disabled={tokens.length < 2}
              style={
                {
                  "--range-progress": `${tokens.length > 1 ? (session.displayIndex / (tokens.length - 1)) * 100 : 0}%`,
                } as CSSProperties
              }
              onChange={(e) =>
                session.seek(state.sectionIndex, Number(e.target.value))
              }
            />
            <span>
              {Math.min(state.wordIndex + 1, tokens.length).toLocaleString(
                "tr",
              )}{" "}
              / {tokens.length.toLocaleString("tr")}
            </span>
          </div>
          <IconButton
            label="Okuma seçenekleri"
            onClick={() => openPanel("options")}
          >
            <SlidersHorizontal size={20} />
          </IconButton>
          {document.fullscreenEnabled && (
            <IconButton
              label={
                fullscreen ? "Tam ekrandan çık (F)" : "Tam ekran odak modu (F)"
              }
              className="fullscreen-button"
              onClick={fullscreenToggle}
            >
              {fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
            </IconButton>
          )}
        </div>
        <p
          className="remaining-time"
          title="Kalan süre, seçili hız ile noktalama, paragraf ve uzun kelime ek sürelerini hesaba katar. WPM değerleri yalnızca aktif oynatma süresinden (duraklamalar hariç) hesaplanır."
        >
          <span>Bölümde {formatTime(remaining.section)}</span>
          <span>Belgede {formatTime(remaining.document)}</span>
          <span className="wpm-stats">
            Gerçek hız: oturum {sessionWpm || "–"} · belge {bookWpm || "–"} ·
            genel {lifetimeWpm || "–"} WPM
          </span>
        </p>
      </div>
      {panel === "options" && (
        <Modal
          title="Okuma seçenekleri"
          className="options-modal"
          onClose={() => setPanel(undefined)}
          footer={
            <button
              type="button"
              className="button"
              onClick={() => setPanel(undefined)}
            >
              Tamam
            </button>
          }
        >
          <Options
            value={state.preferences}
            onChange={session.setPreferences}
            theme={theme}
            onTheme={onTheme}
          />
        </Modal>
      )}
      {panel === "chapters" && (
        <Modal
          title="Bölümler"
          className="chapters-modal"
          onClose={() => setPanel(undefined)}
        >
          <div className="chapter-list">
            {book.sections.map((s, i) => (
              <button
                type="button"
                className={i === state.sectionIndex ? "current" : ""}
                key={s.id}
                onClick={() => {
                  session.seek(i, 0);
                  setPanel(undefined);
                }}
              >
                <span className="chapter-index">{i + 1}</span>
                <span>
                  <strong>{s.title}</strong>
                  <small>{s.wordCount.toLocaleString("tr")} kelime</small>
                </span>
                {i === state.sectionIndex ? (
                  <BookOpen size={18} />
                ) : (
                  <ChevronRight size={17} />
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {panel === "search" && (
        <DocumentSearch
          book={book}
          onClose={() => setPanel(undefined)}
          onJump={(section, word) => {
            session.seek(section, word);
            setPanel(undefined);
          }}
        />
      )}
      {panel === "notes" && (
        <Notes
          book={book}
          progress={state}
          onClose={() => setPanel(undefined)}
          onChange={onNotes}
          onJump={(section, word) => {
            session.seek(section, word);
            setPanel(undefined);
          }}
        />
      )}
    </main>
  );
}

const FullText = memo(function FullText({
  text,
  tokens,
  index,
  end,
  title,
  onSeek,
  playing,
}: {
  text: string;
  tokens: Token[];
  index: number;
  /** Vurgulanan grubun bitişi (hariç) */
  end: number;
  title: string;
  onSeek: (index: number) => void;
  playing: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const customHighlight =
    typeof CSS !== "undefined" &&
    "highlights" in CSS &&
    typeof Highlight !== "undefined";
  const nodes = useMemo(() => {
    if (customHighlight) return text;
    const result: React.ReactNode[] = [];
    let end = 0;
    tokens.forEach((token, i) => {
      if (token.start > end) result.push(text.slice(end, token.start));
      result.push(
        <span key={i} data-word={i}>
          {token.text}
        </span>,
      );
      end = token.end;
    });
    if (end < text.length) result.push(text.slice(end));
    return result;
  }, [text, tokens, customHighlight]);
  useEffect(() => {
    const root = content.current;
    if (!root) return;
    let word: DOMRect | undefined;
    if (
      customHighlight &&
      root.firstChild?.nodeType === Node.TEXT_NODE &&
      tokens[index]
    ) {
      const range = new Range();
      range.setStart(root.firstChild, tokens[index].start);
      range.setEnd(
        root.firstChild,
        tokens[Math.max(index, Math.min(end - 1, tokens.length - 1))].end,
      );
      CSS.highlights.set("reader-current", new Highlight(range));
      word = range.getBoundingClientRect();
    } else {
      root
        .querySelectorAll("[data-current]")
        .forEach((el) => el.removeAttribute("data-current"));
      for (let i = index; i < Math.max(end, index + 1); i++)
        root
          .querySelector(`[data-word="${i}"]`)
          ?.setAttribute("data-current", "true");
      word = root
        .querySelector(`[data-word="${index}"]`)
        ?.getBoundingClientRect();
    }
    if (word) {
      const stage = root.closest(".text-stage")!;
      const bounds = stage.getBoundingClientRect();
      if (word.top < bounds.top + 75 || word.bottom > bounds.bottom - 150) {
        const reducedMotion = matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        stage.scrollTo({
          top: stage.scrollTop + word.top - bounds.top - bounds.height * 0.35,
          behavior: playing || reducedMotion ? "instant" : "smooth",
        });
      }
    }
  }, [index, end, playing, nodes, tokens, customHighlight]);
  useEffect(
    () => () => {
      if (customHighlight) CSS.highlights.delete("reader-current");
    },
    [customHighlight],
  );
  return (
    <article className="full-text">
      <h2>{title}</h2>
      <div
        className="full-text-body"
        ref={content}
        onClick={(e) => {
          if (window.getSelection()?.toString()) return;
          if (customHighlight) {
            const position = document.caretPositionFromPoint?.(
              e.clientX,
              e.clientY,
            );
            const fallback = !position
              ? document.caretRangeFromPoint?.(e.clientX, e.clientY)
              : undefined;
            const node = position?.offsetNode ?? fallback?.startContainer;
            const offset = position?.offset ?? fallback?.startOffset;
            if (node === content.current?.firstChild && offset !== undefined)
              onSeek(tokenIndexAtOffset(tokens, offset));
          } else {
            const target = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-word]",
            );
            if (target) onSeek(Number(target.dataset.word));
          }
        }}
        tabIndex={0}
        aria-label="Belge metni. Okumaya devam etmek için bir kelimeye tıklayın."
      >
        {nodes}
      </div>
    </article>
  );
});

function DocumentSearch({
  book,
  onClose,
  onJump,
}: {
  book: Book;
  onClose: () => void;
  onJump: (section: number, word: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const worker = useRef<Worker>(undefined);
  const request = useRef(0);
  useEffect(() => {
    worker.current = new Worker(
      new URL("../core/search.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current.onmessage = (e) => {
      if (e.data.id === request.current) {
        setMatches(e.data.matches);
        setSearching(false);
      }
    };
    return () => worker.current?.terminate();
  }, []);
  useEffect(() => {
    const id = ++request.current;
    if (!query.trim()) {
      setMatches([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(
      () => worker.current?.postMessage({ id, sections: book.sections, query }),
      140,
    );
    return () => clearTimeout(timer);
  }, [query, book.sections]);
  return (
    <Modal title="Belgede ara" onClose={onClose} className="search-modal">
      <div className="search-field">
        <Search size={18} />
        <input
          autoFocus
          type="search"
          aria-label="Belgede ara"
          placeholder="Kelime veya ifade bulun"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0])
              onJump(matches[0].sectionIndex, matches[0].wordIndex);
          }}
        />
        {query && (
          <IconButton label="Aramayı temizle" onClick={() => setQuery("")}>
            <X size={16} />
          </IconButton>
        )}
      </div>
      <div className="search-summary" role="status">
        {searching
          ? "Aranıyor..."
          : query.trim()
            ? `${matches.length === 500 ? "İlk 500" : matches.length} sonuç`
            : "Tüm bölümlerde arayın"}
      </div>
      <div className="search-results">
        {matches.map((m, i) => (
          <button
            type="button"
            key={`${m.sectionIndex}-${m.wordIndex}-${i}`}
            onClick={() => onJump(m.sectionIndex, m.wordIndex)}
          >
            <small>{book.sections[m.sectionIndex].title}</small>
            <span>
              {m.before}
              <mark>{m.match}</mark>
              {m.after}
            </span>
          </button>
        ))}
        {query.trim() && !searching && !matches.length && (
          <p className="empty-message">
            Sonuç yok. Başka bir kelime veya ifade deneyin.
          </p>
        )}
      </div>
    </Modal>
  );
}

function Notes({
  book,
  progress,
  onClose,
  onChange,
  onJump,
}: {
  book: Book;
  progress: Progress;
  onClose: () => void;
  onChange: (notes: Note[]) => void;
  onJump: (section: number, word: number) => void;
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string>();
  const save = () => {
    if (!text.trim()) return;
    if (editing)
      onChange(
        book.notes.map((n) =>
          n.id === editing ? { ...n, text: text.trim() } : n,
        ),
      );
    else
      onChange([
        ...book.notes,
        {
          id: crypto.randomUUID(),
          text: text.trim(),
          sectionIndex: progress.sectionIndex,
          wordIndex: progress.wordIndex,
          createdAt: Date.now(),
        },
      ]);
    setText("");
    setEditing(undefined);
  };
  return (
    <Modal
      title="Notlar"
      onClose={onClose}
      className="notes-modal"
      footer={
        <button type="button" className="button" onClick={onClose}>
          Tamam
        </button>
      }
    >
      <label className="field-label" htmlFor="note-text">
        {editing ? "Notu düzenle" : "Bulunduğunuz konuma not"}
      </label>
      <textarea
        id="note-text"
        placeholder="Bir düşünce yazın, bir pasajı kaydedin..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="note-compose-footer">
        <span className="fine-print">
          {book.sections[progress.sectionIndex]?.title}
        </span>
        {editing && (
          <button
            type="button"
            className="button"
            onClick={() => {
              setEditing(undefined);
              setText("");
            }}
          >
            Düzenlemeyi bırak
          </button>
        )}
        <button
          type="button"
          className="button primary"
          disabled={!text.trim()}
          onClick={save}
        >
          {editing ? "Notu kaydet" : "Not ekle"}
        </button>
      </div>
      <div className="notes-list">
        {[...book.notes]
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((n) => (
            <div className="note" key={n.id}>
              <p>{n.text}</p>
              <div className="note-meta">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onJump(n.sectionIndex, n.wordIndex)}
                >
                  {book.sections[n.sectionIndex]?.title ?? "Bölüm"}
                  <ChevronRight size={13} />
                </button>
                <span>
                  {new Date(n.createdAt).toLocaleDateString("tr", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="note-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setEditing(n.id);
                    setText(n.text);
                    document.getElementById("note-text")?.focus();
                  }}
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() => {
                    onChange(book.notes.filter((v) => v.id !== n.id));
                    if (editing === n.id) {
                      setEditing(undefined);
                      setText("");
                    }
                  }}
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        {!book.notes.length && (
          <div className="notes-empty">
            <StickyNote size={25} strokeWidth={1.4} />
            <p>Notlarınız burada görünecek.</p>
            <span>Her not, belgede bulunduğunuz yeri hatırlar.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
