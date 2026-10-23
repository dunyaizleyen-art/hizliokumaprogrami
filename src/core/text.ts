import type { Section } from "./types";
import { foldTurkish, letterCount } from "./turkish";

export interface Token {
  text: string;
  start: number;
  end: number;
}

const SUPERSCRIPT_MARK = /([\p{L}.,;:)"”’»])[¹²³⁰⁴-⁹]+(?=\s|$|[.,;:)])/gu;

export function normalize(text: string) {
  return (
    text
      .replace(/\r\n?/g, "\n")
      .replace(/[ ￼​  ]/g, " ")
      .replace(/­/g, "")
      // Kelimeye yapışık üst simge dipnot işaretleri (ör. "kararı¹²")
      .replace(SUPERSCRIPT_MARK, "$1")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Boşluğa göre bölme: "sosyo-ekonomik", "Kanun'un", "(bkz." tek parça kalır. */
export function tokenize(text: string): Token[] {
  return [...text.matchAll(/\S+/gu)]
    .filter((m) => /[\p{L}\p{N}]/u.test(m[0]))
    .map((m) => ({ text: m[0], start: m.index!, end: m.index! + m[0].length }));
}

export function countWords(text: string) {
  let n = 0;
  for (const m of text.matchAll(/\S+/gu)) if (/[\p{L}\p{N}]/u.test(m[0])) n++;
  return n;
}

export function tokenIndexAtOffset(tokens: Token[], offset: number) {
  let lo = 0,
    hi = tokens.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tokens[mid].end <= offset) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, Math.max(0, tokens.length - 1));
}

/** İki kelime arasındaki boşluk türü: 0 = aynı satır, 1 = satır sonu, 2 = paragraf sonu. */
export function gapAfter(text: string, tokens: Token[], index: number) {
  const a = tokens[index];
  const b = tokens[index + 1];
  if (!a) return 0;
  const gap = text.slice(a.end, b ? b.start : text.length);
  if (!b) return 2;
  if (gap.includes("\n\n")) return 2;
  return gap.includes("\n") ? 1 : 0;
}

export function section(title: string, text: string): Section {
  const cleaned = normalize(text);
  return {
    id: crypto.randomUUID(),
    title: title.trim() || "Adsız bölüm",
    text: cleaned,
    wordCount: tokenize(cleaned).length,
  };
}

const HEADING =
  /^(#{1,6}\s+|(?:chapter|section|part|book|bölüm|kısım|kitap)\s+(?:[0-9ivxlcdm]+|[a-zçğıöşü]|birinci|ikinci|üçüncü|dördüncü|beşinci)(?:[:.\-\s]|$))/iu;

/** Uzun ve başlıksız metinleri paragraf sınırında yaklaşık bu kadar kelimelik kısımlara böler. */
const PART_WORDS = 1500;

export function splitSections(text: string, title: string): Section[] {
  const cleaned = normalize(text);
  const lines = cleaned.split("\n");
  const result: Section[] = [];
  let currentTitle = title;
  let current: string[] = [];
  for (const line of lines) {
    if (line.length <= 90 && HEADING.test(line)) {
      if (current.length)
        result.push(section(currentTitle, current.join("\n")));
      currentTitle = line.replace(/^#{1,6}\s*/, "");
      current = [];
    } else current.push(line);
  }
  if (current.length) result.push(section(currentTitle, current.join("\n")));
  const readable = result.filter((s) => s.wordCount > 0);
  if (readable.length > 1) return readable;
  if (countWords(cleaned) <= PART_WORDS * 1.3) return [section(title, cleaned)];
  // Paragraf sınırında böl; cümle ortasında kesme.
  const paragraphs = cleaned.split(/\n\n+/);
  const parts: Section[] = [];
  let buffer: string[] = [];
  let words = 0;
  const flush = () => {
    if (!buffer.length) return;
    parts.push(section(`Kısım ${parts.length + 1}`, buffer.join("\n\n")));
    buffer = [];
    words = 0;
  };
  for (const paragraph of paragraphs) {
    const n = countWords(paragraph);
    if (words && words + n > PART_WORDS * 1.3) flush();
    buffer.push(paragraph);
    words += n;
    if (words >= PART_WORDS) flush();
  }
  flush();
  return parts;
}

/**
 * ORP (Optimal Recognition Point): baştaki tırnak/parantezi atlayıp harf sayısına
 * göre odak harfini seçer. Tek kelimede klasik tablo, öbeklerde metnin ~%35'i.
 * speeedy (MIT) `computeOrp` yaklaşımından uyarlanmıştır.
 */
export function pivot(text: string): [string, string, string] {
  const chars = Array.from(text);
  const isWord = (c: string) => /[\p{L}\p{N}]/u.test(c);
  const letters = letterCount(text);
  if (!letters) return ["", text, ""];
  const multi = /\s/u.test(text.trim());
  let target: number;
  if (multi) target = Math.max(1, Math.round(letters * 0.33));
  else
    target =
      letters <= 1
        ? 0
        : letters <= 5
          ? 1
          : letters <= 9
            ? 2
            : letters <= 13
              ? 3
              : letters <= 18
                ? 4
                : 5;
  let seen = 0;
  for (let i = 0; i < chars.length; i++) {
    if (!isWord(chars[i])) continue;
    if (seen === target) {
      let end = i + 1;
      while (end < chars.length && /\p{M}/u.test(chars[end])) end++;
      return [
        chars.slice(0, i).join(""),
        chars.slice(i, end).join(""),
        chars.slice(end).join(""),
      ];
    }
    seen++;
  }
  return ["", text, ""];
}

export function fold(text: string) {
  return foldTurkish(text);
}
export interface SearchMatch {
  sectionIndex: number;
  wordIndex: number;
  before: string;
  match: string;
  after: string;
}
export function searchDocument(
  sections: Section[],
  query: string,
  limit = 500,
): SearchMatch[] {
  const needle = fold(query.trim());
  if (!needle) return [];
  const matches: SearchMatch[] = [];
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const text = sections[sectionIndex].text;
    const chars = Array.from(text);
    let folded = "";
    const offsets: number[] = [];
    let utf16 = 0;
    for (const char of chars) {
      const normalized = fold(char);
      folded += normalized;
      for (let i = 0; i < normalized.length; i++) offsets.push(utf16);
      utf16 += char.length;
    }
    offsets.push(text.length);
    const tokens = tokenize(text);
    let cursor = 0;
    while (
      (cursor = folded.indexOf(needle, cursor)) !== -1 &&
      matches.length < limit
    ) {
      const start = offsets[cursor],
        end = offsets[cursor + needle.length] ?? text.length;
      matches.push({
        sectionIndex,
        wordIndex: tokenIndexAtOffset(tokens, start),
        before: text.slice(Math.max(0, start - 48), start),
        match: text.slice(start, end),
        after: text.slice(end, end + 70),
      });
      cursor += Math.max(needle.length, 1);
    }
    if (matches.length >= limit) break;
  }
  return matches;
}
