// Gösterim süreleri: hedef hız, kademeli hızlanma ve ayarlanabilir ek süreler.
// Ek süreler "kelime birimi" cinsindendir: %100 = bir kelimelik ek gösterim süresi.
// Böylece toplam süre WPM'den bağımsız bir birim sayısına indirgenir ve kalan
// süre tahmini her hızda tutarlı kalır.
import type { Preferences } from "./types";
import { gapAfter, type Token } from "./text";
import { isClauseEnd, isSentenceEnd, letterCount } from "./turkish";

/** Kademeli hızlanma dahil o anki hız. */
export function currentWpm(p: Preferences, elapsedMs = Infinity) {
  const target = p.wordsPerMinute;
  if (!p.rampSeconds || p.rampStartWpm >= target) return target;
  const t = Math.min(1, Math.max(0, elapsedMs / (p.rampSeconds * 1000)));
  return p.rampStartWpm + (target - p.rampStartWpm) * t;
}

/** Uzun kelime için ek birim: 9 harften itibaren artar, 16 harfte tam değere ulaşır. */
export function longWordUnits(word: string, p: Preferences) {
  const n = letterCount(word);
  if (n < 9 || !p.longWordPause) return 0;
  return (p.longWordPause / 100) * Math.min(1, (n - 8) / 8);
}

/** Bir kelimeden sonra gelen noktalama ve paragraf ek birimi. */
export function boundaryUnits(
  text: string,
  tokens: Token[],
  i: number,
  p: Preferences,
) {
  const word = tokens[i].text;
  const next = tokens[i + 1]?.text;
  const sentence = isSentenceEnd(word, next);
  const gap = gapAfter(text, tokens, i);
  let units = 0;
  if (sentence) units += p.sentencePause / 100;
  else if (isClauseEnd(word)) units += p.commaPause / 100;
  if (gap === 2 || (gap === 1 && sentence)) units += p.paragraphPause / 100;
  return units;
}

/** [start, end) grubunun milisaniye cinsinden gösterim süresi. */
export function chunkDuration(
  text: string,
  tokens: Token[],
  start: number,
  end: number,
  p: Preferences,
  elapsedMs = Infinity,
) {
  const count = Math.max(1, end - start);
  let units = count;
  for (let i = start; i < end; i++) units += longWordUnits(tokens[i].text, p);
  if (end > start) units += boundaryUnits(text, tokens, end - 1, p);
  return (60000 / currentWpm(p, elapsedMs)) * units;
}

/**
 * Bölümün kelime birimi önek toplamları: prefix[i] = ilk i kelimenin birimi.
 * Kalan süre = (prefix[n] - prefix[i]) * 60 / WPM.
 */
export function unitPrefix(text: string, tokens: Token[], p: Preferences) {
  const prefix = new Float64Array(tokens.length + 1);
  for (let i = 0; i < tokens.length; i++)
    prefix[i + 1] =
      prefix[i] +
      1 +
      longWordUnits(tokens[i].text, p) +
      boundaryUnits(text, tokens, i, p);
  return prefix;
}
