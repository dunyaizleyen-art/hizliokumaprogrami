// Kelime gruplama: sabit 1/2/3 kelime veya Türkçe kurallarla "öbek modu".
import type { ChunkMode } from "./types";
import { gapAfter, type Token } from "./text";
import {
  bare,
  CLITICS,
  CONJUNCTIONS,
  isClauseEnd,
  isNumberLike,
  isSentenceEnd,
  letterCount,
  POSTPOSITIONS,
} from "./turkish";

/** Öbek modunda bir grubun üst sınırları */
export const PHRASE_MAX_WORDS = 3;
export const PHRASE_MAX_LETTERS = 22;
/** Bu uzunluktaki kelimeler öbek modunda tek başına gösterilir */
export const LONG_WORD = 13;

/** Bir kelimeden sonra grup kesilmeli mi (noktalama veya satır sonu)? */
function breaksAfter(text: string, tokens: Token[], i: number) {
  const t = tokens[i].text;
  if (gapAfter(text, tokens, i) > 0) return true;
  if (isClauseEnd(t)) return true;
  // Kısaltma ("bkz.") ve sıra sayısı ("7.") noktaları grubu kesmez.
  return isSentenceEnd(t, tokens[i + 1]?.text);
}

/** `start` konumundan başlayan grubun bitişi (hariç). */
export function chunkEnd(
  text: string,
  tokens: Token[],
  start: number,
  mode: ChunkMode,
): number {
  if (start >= tokens.length) return tokens.length;
  if (mode !== "phrase") return Math.min(tokens.length, start + mode);
  let end = start + 1;
  let letters = letterCount(tokens[start].text);
  if (letters >= LONG_WORD) return end;
  // Bir sonraki kelime edat veya ek ise, ilk kelime uzun olsa da bağlanabilir.
  while (end < tokens.length && end - start < PHRASE_MAX_WORDS) {
    if (breaksAfter(text, tokens, end - 1)) break;
    const word = tokens[end].text;
    const key = bare(word);
    const n = letterCount(word);
    const attaches = POSTPOSITIONS.has(key) || CLITICS.has(key);
    if (CONJUNCTIONS.has(key) && !CLITICS.has(key)) break;
    if (!attaches) {
      if (n >= LONG_WORD) break;
      if (letters + n > PHRASE_MAX_LETTERS) break;
    } else if (letters + n > PHRASE_MAX_LETTERS + 8) break;
    end++;
    letters += n;
    if (POSTPOSITIONS.has(key)) break;
    // Sayıdan sonraki kelime ("2577 sayılı", "7. madde") gruba girer, sonra kapanır.
    if (isNumberLike(tokens[end - 2].text) && !isNumberLike(word)) break;
  }
  return end;
}

/** Cümlenin başladığı kelime indeksi (`index` dahil, geriye doğru). */
export function sentenceStart(tokens: Token[], index: number) {
  let i = Math.min(index, tokens.length - 1);
  while (i > 0 && !isSentenceEnd(tokens[i - 1].text, tokens[i].text)) i--;
  return Math.max(0, i);
}

/** Bir sonraki cümlenin ilk kelimesi; yoksa tokens.length. */
export function nextSentenceStart(tokens: Token[], index: number) {
  for (let i = index; i < tokens.length - 1; i++)
    if (isSentenceEnd(tokens[i].text, tokens[i + 1].text)) return i + 1;
  return tokens.length;
}

/** `index`ten önceki grubun başlangıcı. */
export function previousChunkStart(
  text: string,
  tokens: Token[],
  index: number,
  mode: ChunkMode,
) {
  if (index <= 0) return 0;
  if (mode !== "phrase") return Math.max(0, index - mode);
  // Cümle başından itibaren gruplayarak `index`ten önceki son grubu bul.
  let start = sentenceStart(tokens, index - 1);
  let last = start;
  while (start < index) {
    last = start;
    start = chunkEnd(text, tokens, start, mode);
  }
  return last;
}
