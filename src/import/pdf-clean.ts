// PDF metin temizliği (pdf.js'ten bağımsız, test edilebilir saf fonksiyonlar).
// Rapid Reader (MIT) `cleanPDFPages` fikri genişletildi: rakamları maskeleyerek
// tekrar eden üstbilgi/altbilgi, Türkçe sayfa numarası kalıpları, üst simge dipnot
// numaraları, sayfa altı dipnot blokları ve satırların paragraflara yeniden akışı.

export interface PdfItem {
  str: string;
  x: number;
  /** Taban çizgisi (PDF koordinatı: aşağıdan yukarı) */
  y: number;
  width: number;
  height: number;
}
export interface PdfLine {
  text: string;
  x: number;
  y: number;
  size: number;
}
export interface PdfPage {
  lines: PdfLine[];
  height: number;
}

const FOOTNOTE_MARK = /^[\d*†‡]+[.,]?$/u;

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** pdf.js öğelerinden satır oluşturur; üst simge dipnot numaralarını atar. */
export function buildLines(items: PdfItem[], stripMarks = true): PdfLine[] {
  const groups: PdfItem[][] = [];
  let current: PdfItem[] = [];
  let lineY = NaN;
  let lineSize = 0;
  for (const item of items) {
    if (!item.str) continue;
    const size = item.height || lineSize || 10;
    if (
      current.length &&
      Math.abs(item.y - lineY) > 0.55 * Math.max(lineSize, size)
    ) {
      groups.push(current);
      current = [];
    }
    if (!current.length) {
      lineY = item.y;
      lineSize = size;
    } else if (size > lineSize && item.str.trim()) {
      // Satırın taban çizgisi, en büyük yazı boyutlu öğeye göre belirlenir.
      lineSize = size;
      lineY = item.y;
    }
    current.push(item);
  }
  if (current.length) groups.push(current);
  const lines: PdfLine[] = [];
  for (const group of groups) {
    const visible = group.filter((i) => i.str.trim());
    if (!visible.length) continue;
    const size = Math.max(...visible.map((i) => i.height || 0)) || 10;
    const base = median(
      visible.filter((i) => (i.height || 0) >= size * 0.85).map((i) => i.y),
    );
    let text = "";
    let prevEnd: number | undefined;
    for (const item of group) {
      const h = item.height || size;
      const raised = item.y - base > size * 0.12;
      if (
        stripMarks &&
        h < size * 0.82 &&
        raised &&
        FOOTNOTE_MARK.test(item.str.trim()) &&
        text.trim()
      ) {
        prevEnd = item.x + item.width;
        continue;
      }
      if (
        text &&
        !/\s$/u.test(text) &&
        !/^\s/u.test(item.str) &&
        prevEnd !== undefined &&
        item.x - prevEnd > size * 0.12
      )
        text += " ";
      text += item.str;
      prevEnd = item.x + item.width;
    }
    text = text.replace(/\s+/gu, " ").trim();
    if (text)
      lines.push({
        text,
        x: Math.min(...visible.map((i) => i.x)),
        y: base,
        size,
      });
  }
  return lines;
}

const PAGE_NUMBER =
  /^(?:(?:sayfa|sf\.?|s\.|page|p\.)\s*)?[-–—]?\s*\d{1,4}\s*[-–—]?(?:\s*(?:\/|of|-)\s*\d{1,4})?$/iu;
const ROMAN =
  /^(?=[mdclxvi])m{0,3}(c[md]|d?c{0,3})(x[cl]|l?x{0,3})(i[xv]|v?i{0,3})$/iu;

export function isPageNumber(text: string) {
  const t = text.trim();
  return (
    PAGE_NUMBER.test(t) ||
    (t.length <= 7 && ROMAN.test(t.replace(/^[-–—]\s*|\s*[-–—]$/gu, "")))
  );
}
const marginKey = (text: string) =>
  text
    .replace(/\d+/gu, "#")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("tr");

/** Sayfaların önemli bir kısmında tekrar eden ilk/son satırları ve sayfa numaralarını siler. */
export function removeMargins(pages: PdfPage[]): PdfPage[] {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const edge = new Set(
      [...page.lines.slice(0, 2), ...page.lines.slice(-2)]
        .filter((l) => l.text.length <= 120)
        .map((l) => marginKey(l.text)),
    );
    for (const key of edge) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.4));
  const margin = (line: PdfLine) =>
    isPageNumber(line.text) ||
    (pages.length >= 3 && (counts.get(marginKey(line.text)) ?? 0) >= threshold);
  return pages.map((page) => {
    const lines = [...page.lines];
    for (let k = 0; k < 2 && lines.length && margin(lines[0]); k++)
      lines.shift();
    for (let k = 0; k < 2 && lines.length && margin(lines.at(-1)!); k++)
      lines.pop();
    return { ...page, lines };
  });
}

/** Belgedeki ana gövde yazı boyutu (metin uzunluğuyla ağırlıklı ortanca). */
export function bodySize(pages: PdfPage[]) {
  const weighted: number[] = [];
  for (const page of pages)
    for (const line of page.lines) {
      const n = Math.min(200, Math.ceil(line.text.length / 10));
      for (let i = 0; i < n; i++)
        weighted.push(Math.round(line.size * 10) / 10);
    }
  return median(weighted);
}

/** Sayfa altındaki, gövdeden küçük puntolu ve numarayla başlayan dipnot bloklarını siler. */
export function removeFootnotes(pages: PdfPage[]): PdfPage[] {
  const body = bodySize(pages);
  if (!body) return pages;
  return pages.map((page) => {
    const lines = page.lines;
    let cut = lines.length;
    let marked = false;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const low = !page.height || line.y < page.height * 0.5;
      if (!low || line.size >= body * 0.92) break;
      if (/^[\d*†‡]{1,3}[.)]?\s*\S/u.test(line.text)) marked = true;
      cut = i;
    }
    if (!marked || cut === 0) return page;
    return { ...page, lines: lines.slice(0, cut) };
  });
}

const SENTENCE_END = /[.!?:;…"”»)]$/u;

/** Satırları paragraflara akıtır; satır sonu tirelerini birleştirir. */
export function reflow(pages: PdfPage[]): string[] {
  const spacings: number[] = [];
  const lengths: number[] = [];
  const lefts: number[] = [];
  for (const page of pages) {
    page.lines.forEach((line, i) => {
      lengths.push(line.text.length);
      lefts.push(Math.round(line.x));
      const next = page.lines[i + 1];
      if (next && Math.abs(next.size - line.size) < 0.5) {
        const dy = line.y - next.y;
        if (dy > 0) spacings.push(dy);
      }
    });
  }
  const spacing = median(spacings) || 12;
  const typical = median(lengths) || 60;
  const left = median(lefts);
  return pages.map((page) => {
    let text = "";
    page.lines.forEach((line, i) => {
      const prev = page.lines[i - 1];
      if (!prev) {
        text = line.text;
        return;
      }
      const dy = prev.y - line.y;
      const indented = line.x > left + line.size * 1.2;
      const shortEnd =
        SENTENCE_END.test(prev.text) && prev.text.length < typical * 0.8;
      const breakParagraph =
        dy > spacing * 1.45 ||
        dy < 0 || // sütun değişimi
        Math.abs(prev.size - line.size) > 1 ||
        shortEnd ||
        (indented && SENTENCE_END.test(prev.text));
      if (
        /\p{Ll}-$/u.test(text) &&
        /^\p{Ll}/u.test(line.text) &&
        !breakParagraph
      )
        text = text.slice(0, -1) + line.text;
      else text += (breakParagraph ? "\n\n" : " ") + line.text;
    });
    return text;
  });
}

/** Sayfa metinlerini birleştirir: cümle sayfa sonunda bitmiyorsa paragraf kesilmez. */
export function joinPages(pages: string[]) {
  let text = "";
  for (const page of pages) {
    if (!page.trim()) continue;
    if (!text) text = page;
    else if (/\p{Ll}-$/u.test(text) && /^\p{Ll}/u.test(page))
      text = text.slice(0, -1) + page;
    else if (/[.!?:…"”»)]$/u.test(text)) text += "\n\n" + page;
    else text += " " + page;
  }
  return text;
}

export function cleanPages(
  pages: PdfPage[],
  options: { footnotes: boolean },
): string[] {
  let result = removeMargins(pages);
  if (options.footnotes) result = removeFootnotes(result);
  return reflow(result);
}
