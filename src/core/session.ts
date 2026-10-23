// Oynatma oturumu. Rapid Reader (MIT) ReaderSession temel alınmıştır: son tarih
// (deadline) tabanlı kaymasız zamanlayıcı korunmuş; değişken uzunlukta gruplar,
// öbek modu, cümle geri/ileri, kalan süre ve oturum WPM eklenmiştir.
import { tokenize, type Token } from "./text";
import {
  chunkEnd,
  nextSentenceStart,
  previousChunkStart,
  sentenceStart,
} from "./chunker";
import { chunkDuration, unitPrefix } from "./timing";
import {
  clamp,
  clampPreferences,
  type Book,
  type Preferences,
  type Progress,
} from "./types";

export interface SessionState extends Progress {
  playing: boolean;
  preferences: Preferences;
  /** Bu oturumda (belge açıkken) aktif oynatmada gösterilen kelime ve süre */
  sessionWords: number;
  sessionSeconds: number;
}
export class ReaderSession {
  readonly book: Book;
  private state: SessionState;
  private listeners = new Set<() => void>();
  private cache = new Map<number, Token[]>();
  private prefixCache = new Map<number, Float64Array>();
  private prefixKey = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private startedAt = 0;
  private segmentWords = 0;
  private rewindOnResume = false;
  private deadline = 0;
  private lastReport = 0;
  onProgress?: (progress: Progress, preferences: Preferences) => void;
  onSegment?: (words: number, seconds: number, startedAt: number) => void;

  constructor(book: Book) {
    this.book = book;
    const sectionIndex = clamp(
      book.progress.sectionIndex,
      0,
      Math.max(0, book.sections.length - 1),
    );
    this.state = {
      sectionIndex,
      wordIndex: clamp(
        book.progress.wordIndex,
        0,
        this.tokens(sectionIndex).length,
      ),
      playing: false,
      preferences: clampPreferences(book.preferences),
      sessionWords: 0,
      sessionSeconds: 0,
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(value: Partial<SessionState>) {
    this.state = { ...this.state, ...value };
    this.listeners.forEach((fn) => fn());
  }
  tokens(index = this.state?.sectionIndex ?? 0): Token[] {
    if (!this.cache.has(index))
      this.cache.set(index, tokenize(this.book.sections[index]?.text ?? ""));
    return this.cache.get(index)!;
  }
  private text(index = this.state.sectionIndex) {
    return this.book.sections[index]?.text ?? "";
  }
  get displayIndex() {
    return clamp(
      this.state.wordIndex,
      0,
      Math.max(0, this.tokens().length - 1),
    );
  }
  /** Gösterilen grubun bitişi (hariç). */
  get displayEnd() {
    return chunkEnd(
      this.text(),
      this.tokens(),
      this.displayIndex,
      this.state.preferences.chunkMode,
    );
  }
  get displayWords() {
    return this.tokens()
      .slice(this.displayIndex, this.displayEnd)
      .map((t) => t.text);
  }
  get atEnd() {
    return (
      this.state.sectionIndex >= this.book.sections.length - 1 &&
      this.state.wordIndex >= this.tokens().length
    );
  }
  toggle = () => {
    this.state.playing ? this.pause() : this.play();
  };
  play = () => {
    if (this.state.playing) return;
    if (this.atEnd) this.seek(0, 0);
    else if (this.rewindOnResume)
      this.update({
        wordIndex: Math.max(
          0,
          this.state.wordIndex - this.state.preferences.resumeRewindWords,
        ),
      });
    this.rewindOnResume = false;
    while (
      !this.tokens().length &&
      this.state.sectionIndex + 1 < this.book.sections.length
    )
      this.update({ sectionIndex: this.state.sectionIndex + 1, wordIndex: 0 });
    if (!this.tokens().length) return;
    this.startedAt = performance.now();
    this.segmentWords = 0;
    this.deadline = this.startedAt;
    this.update({ playing: true });
    this.schedule();
  };
  private schedule() {
    const now = performance.now();
    const start = this.displayIndex;
    const end = this.displayEnd;
    const duration = chunkDuration(
      this.text(),
      this.tokens(),
      start,
      end,
      this.state.preferences,
      now - this.startedAt,
    );
    if (now - this.deadline > 1000) this.deadline = now;
    this.deadline += duration;
    this.timer = setTimeout(
      () => {
        if (!this.state.playing) return;
        this.segmentWords += end - start;
        if (!this.advance(true)) {
          this.pause();
          return;
        }
        this.report(false);
        this.schedule();
      },
      Math.max(0, this.deadline - now),
    );
  }
  private reschedule() {
    if (!this.state.playing) return;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.deadline = performance.now();
    this.schedule();
  }
  pause = () => {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.state.playing) {
      this.rewindOnResume = true;
      const seconds = (performance.now() - this.startedAt) / 1000;
      this.onSegment?.(
        this.segmentWords,
        seconds,
        Date.now() - (performance.now() - this.startedAt),
      );
      if (this.segmentWords > 0)
        this.state = {
          ...this.state,
          sessionWords: this.state.sessionWords + this.segmentWords,
          sessionSeconds: this.state.sessionSeconds + seconds,
        };
    }
    this.segmentWords = 0;
    this.update({ playing: false });
    this.report(true);
  };
  /** Oynatma sürüyorsa o anki segmentin canlı değerleriyle oturum toplamı. */
  liveSession() {
    const extra = this.state.playing
      ? {
          words: this.segmentWords,
          seconds: (performance.now() - this.startedAt) / 1000,
        }
      : { words: 0, seconds: 0 };
    return {
      words: this.state.sessionWords + extra.words,
      seconds: this.state.sessionSeconds + extra.seconds,
    };
  }
  private advance(forward: boolean) {
    const { sectionIndex, wordIndex, preferences } = this.state;
    const tokens = this.tokens();
    if (forward) {
      const end = chunkEnd(
        this.text(),
        tokens,
        Math.min(wordIndex, tokens.length),
        preferences.chunkMode,
      );
      if (end < tokens.length) this.update({ wordIndex: end });
      else if (sectionIndex + 1 < this.book.sections.length)
        this.update({ sectionIndex: sectionIndex + 1, wordIndex: 0 });
      else {
        this.update({ wordIndex: tokens.length });
        return false;
      }
    } else {
      if (wordIndex > 0)
        this.update({
          wordIndex: Math.min(
            previousChunkStart(
              this.text(),
              tokens,
              Math.min(wordIndex, tokens.length),
              preferences.chunkMode,
            ),
            Math.max(0, tokens.length - 1),
          ),
        });
      else if (sectionIndex > 0) {
        const prev = this.tokens(sectionIndex - 1);
        this.update({
          sectionIndex: sectionIndex - 1,
          wordIndex: previousChunkStart(
            this.text(sectionIndex - 1),
            prev,
            prev.length,
            preferences.chunkMode,
          ),
        });
      } else this.update({ wordIndex: 0 });
    }
    return true;
  }
  step = (forward: boolean) => {
    this.pause();
    this.rewindOnResume = false;
    this.advance(forward);
    this.report(true);
  };
  /** Oynatmayı durdurmadan konum değiştirir. */
  private moveTo(sectionIndex: number, wordIndex: number) {
    this.rewindOnResume = false;
    this.update({ sectionIndex, wordIndex });
    this.reschedule();
    this.report(true);
  }
  /** Cümle başına döner; zaten cümle başındaysa bir önceki cümleye gider. */
  sentenceBack = () => {
    const { sectionIndex } = this.state;
    const tokens = this.tokens();
    const index = this.displayIndex;
    const start = sentenceStart(tokens, index);
    if (index - start >= 2) return this.moveTo(sectionIndex, start);
    if (start > 0)
      return this.moveTo(sectionIndex, sentenceStart(tokens, start - 1));
    if (sectionIndex > 0) {
      const prev = this.tokens(sectionIndex - 1);
      return this.moveTo(
        sectionIndex - 1,
        sentenceStart(prev, Math.max(0, prev.length - 1)),
      );
    }
    this.moveTo(0, 0);
  };
  sentenceForward = () => {
    const { sectionIndex } = this.state;
    const tokens = this.tokens();
    const next = nextSentenceStart(tokens, this.displayIndex);
    if (next < tokens.length) return this.moveTo(sectionIndex, next);
    if (sectionIndex + 1 < this.book.sections.length)
      this.moveTo(sectionIndex + 1, 0);
  };
  seek = (sectionIndex: number, wordIndex = 0) => {
    this.pause();
    this.rewindOnResume = false;
    sectionIndex = clamp(
      sectionIndex,
      0,
      Math.max(0, this.book.sections.length - 1),
    );
    this.update({
      sectionIndex,
      wordIndex: clamp(
        wordIndex,
        0,
        Math.max(0, this.tokens(sectionIndex).length - 1),
      ),
    });
    this.report(true);
  };
  setPreferences = (value: Partial<Preferences>) => {
    this.update({
      preferences: clampPreferences({ ...this.state.preferences, ...value }),
    });
    this.reschedule();
    this.report(true);
  };
  private prefix(index: number) {
    const p = this.state.preferences;
    const key = [
      p.sentencePause,
      p.commaPause,
      p.paragraphPause,
      p.longWordPause,
    ].join();
    if (key !== this.prefixKey) {
      this.prefixCache.clear();
      this.prefixKey = key;
    }
    if (!this.prefixCache.has(index))
      this.prefixCache.set(
        index,
        unitPrefix(this.text(index), this.tokens(index), p),
      );
    return this.prefixCache.get(index)!;
  }
  /** Ek süreler dahil kalan süre tahmini (saniye): bölüm ve belge. */
  remaining() {
    const wpm = this.state.preferences.wordsPerMinute;
    const { sectionIndex, wordIndex } = this.state;
    const current = this.prefix(sectionIndex);
    const at = Math.min(wordIndex, current.length - 1);
    const section = current[current.length - 1] - current[at];
    let rest = 0;
    for (let i = sectionIndex + 1; i < this.book.sections.length; i++) {
      const p = this.prefix(i);
      rest += p[p.length - 1];
    }
    return {
      section: (section * 60) / wpm,
      document: ((section + rest) * 60) / wpm,
    };
  }
  private report(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastReport < 1000) return;
    this.lastReport = now;
    this.onProgress?.(
      {
        sectionIndex: this.state.sectionIndex,
        wordIndex: this.state.wordIndex,
      },
      this.state.preferences,
    );
  }
  dispose() {
    this.pause();
    this.listeners.clear();
  }
}
