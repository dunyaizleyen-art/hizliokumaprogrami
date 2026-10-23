export type Theme = "system" | "light" | "dark" | "sepia";
export type Format =
  | "epub"
  | "pdf"
  | "docx"
  | "rtf"
  | "html"
  | "markdown"
  | "plainText"
  | "webArticle";

export type ChunkMode = 1 | 2 | 3 | "phrase";
export interface Preferences {
  wordsPerMinute: number;
  fontSize: number;
  chunkMode: ChunkMode;
  showContext: boolean;
  focusMode: boolean;
  /** Duraklatınca tam metin bağlam görünümü */
  contextOnPause: boolean;
  /** Ek süreler, bir kelimenin gösterim süresinin yüzdesi olarak (0 = kapalı) */
  sentencePause: number;
  commaPause: number;
  paragraphPause: number;
  longWordPause: number;
  /** Kademeli hızlanma: rampStartWpm'den hedef hıza rampSeconds saniyede çıkar (0 = kapalı) */
  rampStartWpm: number;
  rampSeconds: number;
  resumeRewindWords: number;
}

export const MIN_WPM = 100;
export const MAX_WPM = 1200;

export const defaultPreferences: Preferences = {
  wordsPerMinute: 350,
  fontSize: 80,
  chunkMode: 1,
  showContext: true,
  focusMode: false,
  contextOnPause: true,
  sentencePause: 150,
  commaPause: 50,
  paragraphPause: 250,
  longWordPause: 60,
  rampStartWpm: 200,
  rampSeconds: 0,
  resumeRewindWords: 0,
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export function clampPreferences(value: Partial<Preferences>): Preferences {
  const p = { ...defaultPreferences, ...value };
  const number = (v: number, fallback: number, min: number, max: number) =>
    Number.isFinite(v) ? clamp(v, min, max) : fallback;
  const bool = (v: unknown, fallback: boolean) =>
    typeof v === "boolean" ? v : fallback;
  // Rapid Reader'ın eski "chunkSize" alanından geçiş
  const legacy = (value as { chunkSize?: number }).chunkSize;
  const mode =
    value.chunkMode === "phrase"
      ? "phrase"
      : (Math.round(number(Number(value.chunkMode ?? legacy), 1, 1, 3)) as
          1 | 2 | 3);
  return {
    wordsPerMinute: Math.round(number(p.wordsPerMinute, 350, MIN_WPM, MAX_WPM)),
    fontSize: number(p.fontSize, 80, 42, 140),
    chunkMode: mode,
    showContext: bool(p.showContext, true),
    focusMode: bool(p.focusMode, false),
    contextOnPause: bool(p.contextOnPause, true),
    sentencePause: Math.round(number(p.sentencePause, 150, 0, 400)),
    commaPause: Math.round(number(p.commaPause, 50, 0, 300)),
    paragraphPause: Math.round(number(p.paragraphPause, 250, 0, 600)),
    longWordPause: Math.round(number(p.longWordPause, 60, 0, 200)),
    rampStartWpm: Math.round(number(p.rampStartWpm, 200, MIN_WPM, MAX_WPM)),
    rampSeconds: Math.round(number(p.rampSeconds, 0, 0, 120)),
    resumeRewindWords: Math.round(number(p.resumeRewindWords, 0, 0, 20)),
  };
}

export interface Section {
  id: string;
  title: string;
  text: string;
  wordCount: number;
}
export interface Note {
  id: string;
  sectionIndex: number;
  wordIndex: number;
  text: string;
  createdAt: number;
}
export interface Progress {
  sectionIndex: number;
  wordIndex: number;
}
export interface Book {
  id: string;
  title: string;
  author?: string;
  sourceName: string;
  sourceURL?: string;
  format: Format;
  importedAt: number;
  lastReadAt?: number;
  sections: Section[];
  progress: Progress;
  preferences: Preferences;
  isFavorite: boolean;
  notes: Note[];
  cover?: string;
  fingerprint: string;
  /** Bu belgedeki gerçek okuma: gösterilen kelime ve aktif oynatma süresi */
  stats?: ReadingTotals;
}
export interface ReadingTotals {
  words: number;
  seconds: number;
}
export type BookMetadata = Omit<Book, "sections"> & {
  sections: Omit<Section, "text">[];
};
export interface ImportedDocument {
  title: string;
  author?: string;
  sourceName: string;
  sourceURL?: string;
  format: Format;
  sections: Section[];
  cover?: string;
}
export interface DailyStats {
  date: string;
  words: number;
  seconds: number;
}
export interface Settings {
  theme: Theme;
  /** PDF içe aktarırken dipnot numaralarını ve sayfa altı dipnotları ayıkla */
  stripFootnotes: boolean;
  defaults: Preferences;
  selectedID?: string;
  mode: "rsvp" | "text";
}
export const defaultSettings: Settings = {
  theme: "dark",
  stripFootnotes: true,
  defaults: { ...defaultPreferences },
  mode: "rsvp",
};

export function metadata(book: Book): BookMetadata {
  return {
    ...book,
    sections: book.sections.map(({ id, title, wordCount }) => ({
      id,
      title,
      wordCount,
    })),
  };
}
export function totalWords(book: Pick<BookMetadata, "sections">) {
  return book.sections.reduce((n, s) => n + s.wordCount, 0);
}
export function completedWords(
  book: Pick<BookMetadata, "sections" | "progress">,
) {
  const section = clamp(
    book.progress.sectionIndex,
    0,
    Math.max(0, book.sections.length - 1),
  );
  return (
    book.sections.slice(0, section).reduce((n, s) => n + s.wordCount, 0) +
    clamp(book.progress.wordIndex, 0, book.sections[section]?.wordCount ?? 0)
  );
}
export function fraction(book: Pick<BookMetadata, "sections" | "progress">) {
  return totalWords(book) ? completedWords(book) / totalWords(book) : 0;
}
export function formatTime(seconds: number) {
  if (seconds <= 0) return "0 dk";
  if (seconds < 60) return "<1 dk";
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60
    ? `${minutes} dk`
    : `${Math.floor(minutes / 60)} sa ${minutes % 60 ? `${minutes % 60} dk` : ""}`.trim();
}
export function wpmOf(totals?: ReadingTotals) {
  return totals && totals.seconds >= 5
    ? Math.round((totals.words / totals.seconds) * 60)
    : 0;
}
export function localDate(time = Date.now()) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const formatLabels: Record<Format, string> = {
  epub: "EPUB",
  pdf: "PDF",
  docx: "Word belgesi",
  rtf: "Zengin metin",
  html: "HTML",
  markdown: "Markdown",
  plainText: "Metin",
  webArticle: "Makale",
};
