import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalize,
  pivot,
  searchDocument,
  section,
  tokenize,
} from "../src/core/text";
import { isAbbreviation, isSentenceEnd } from "../src/core/turkish";
import {
  chunkEnd,
  nextSentenceStart,
  previousChunkStart,
  sentenceStart,
} from "../src/core/chunker";
import { ReaderSession } from "../src/core/session";
import {
  defaultPreferences,
  type Book,
  type ChunkMode,
} from "../src/core/types";

const SAMPLE =
  "İdarenin değerlendirilebileceğinden, Türkiye'nin sosyo-ekonomik (bkz. AYM kararı) “Danıştay” 2577 s. Kanun'un 7/2. maddesi; çağdaş ŞÜPHE ığdır.";

function groups(text: string, mode: ChunkMode) {
  const t = normalize(text);
  const tokens = tokenize(t);
  const out: string[] = [];
  for (let i = 0; i < tokens.length;) {
    const end = chunkEnd(t, tokens, i, mode);
    out.push(
      tokens
        .slice(i, end)
        .map((x) => x.text)
        .join(" "),
    );
    i = end;
  }
  return out;
}

afterEach(() => vi.useRealTimers());

describe("Türkçe bölme", () => {
  it("karakterleri korur ve kelimeleri doğru böler", () => {
    expect(tokenize(normalize(SAMPLE)).map((t) => t.text)).toEqual([
      "İdarenin",
      "değerlendirilebileceğinden,",
      "Türkiye'nin",
      "sosyo-ekonomik",
      "(bkz.",
      "AYM",
      "kararı)",
      "“Danıştay”",
      "2577",
      "s.",
      "Kanun'un",
      "7/2.",
      "maddesi;",
      "çağdaş",
      "ŞÜPHE",
      "ığdır.",
    ]);
  });
  it("kelimeye yapışık üst simge dipnot işaretlerini ve yumuşak tireyi siler", () => {
    expect(normalize("kararı¹² ile de­ğer")).toBe("kararı ile değer");
  });
  it("kısaltma ve sıra sayılarını cümle sonu saymaz", () => {
    expect(isAbbreviation("bkz.")).toBe(true);
    expect(isAbbreviation("(bkz.")).toBe(true);
    expect(isAbbreviation("Prof.")).toBe(true);
    expect(isAbbreviation("R.G.")).toBe(true);
    expect(isAbbreviation("karar.")).toBe(false);
    expect(isSentenceEnd("s.", "Kanun'un")).toBe(false);
    expect(isSentenceEnd("7.", "madde")).toBe(false);
    expect(isSentenceEnd("7.", "12")).toBe(false);
    expect(isSentenceEnd("verilmiştir.", "Bu")).toBe(true);
    expect(isSentenceEnd("2020.", "Bu")).toBe(true);
    expect(isSentenceEnd("ığdır.", undefined)).toBe(true);
    expect(isSentenceEnd("Neden?", "Çünkü")).toBe(true);
    expect(isSentenceEnd("kararı)", "Danıştay")).toBe(false);
  });
  it("uzun sondan eklemeli kelimede odağı ilk üçte birlik bölüme koyar", () => {
    const [before, center] = pivot("değerlendirilebileceğinden");
    expect(before).toBe("değer");
    expect(center).toBe("l");
    expect(pivot("(bkz.")).toEqual(["(b", "k", "z."]);
    expect(pivot("İdarenin")[1]).toBe("a");
  });
  it("aramada İ/ı ve aksanları Türkçeye göre katlar", () => {
    const sections = [section("A", "İSTANBUL ve Istanbul, ılık IŞIK.")];
    expect(searchDocument(sections, "istanbul")).toHaveLength(2);
    expect(searchDocument(sections, "ışık")).toHaveLength(1);
  });
});

describe("gruplama", () => {
  it("sabit 2 kelimelik grup", () => {
    expect(groups("Bir iki üç dört beş", 2)).toEqual([
      "Bir iki",
      "üç dört",
      "beş",
    ]);
  });
  it("öbek modu noktalama, bağlaç, edat ve uzun kelimeye göre gruplar", () => {
    expect(
      groups(
        "Danıştay bu kararı iptal etti ve idarenin işlemi hukuka aykırı bulundu. Kanun için bir değerlendirilebileceğinden söz edildi, 2577 sayılı Kanun uygulandı.",
        "phrase",
      ),
    ).toEqual([
      "Danıştay bu kararı",
      "iptal etti",
      "ve idarenin işlemi",
      "hukuka aykırı bulundu.",
      "Kanun için",
      "bir",
      "değerlendirilebileceğinden",
      "söz edildi,",
      "2577 sayılı",
      "Kanun uygulandı.",
    ]);
  });
  it("satır sonunda grubu keser ve geri adımda aynı sınırları bulur", () => {
    const text = normalize(
      "Birinci satır burada\nİkinci satır burada. Sonra gelen cümle",
    );
    const tokens = tokenize(text);
    const starts: number[] = [];
    for (let i = 0; i < tokens.length; i = chunkEnd(text, tokens, i, "phrase"))
      starts.push(i);
    expect(starts[1]).toBe(3);
    for (let k = starts.length - 1; k > 0; k--)
      expect(previousChunkStart(text, tokens, starts[k], "phrase")).toBe(
        starts[k - 1],
      );
  });
});

describe("cümle gezinme", () => {
  const text = normalize(
    "İlk cümle burada bitiyor. Prof. Dr. Yılmaz 7. maddeyi inceledi. Üçüncü cümle.",
  );
  const tokens = tokenize(text);
  it("cümle başlangıçlarını kısaltmalara takılmadan bulur", () => {
    expect(sentenceStart(tokens, 6)).toBe(4);
    expect(nextSentenceStart(tokens, 0)).toBe(4);
    expect(nextSentenceStart(tokens, 4)).toBe(10);
  });
  it("oturumda 1 cümle geri sarar", () => {
    const book: Book = {
      id: "t",
      title: "t",
      sourceName: "t",
      format: "plainText",
      importedAt: 0,
      fingerprint: "t",
      sections: [section("A", text)],
      progress: { sectionIndex: 0, wordIndex: 7 },
      preferences: { ...defaultPreferences },
      isFavorite: false,
      notes: [],
    };
    const s = new ReaderSession(book);
    s.sentenceBack();
    expect(s.getSnapshot().wordIndex).toBe(4);
    s.sentenceBack();
    expect(s.getSnapshot().wordIndex).toBe(0);
    s.sentenceForward();
    expect(s.getSnapshot().wordIndex).toBe(4);
    s.dispose();
  });
  it("1200 WPM ve öbek modunda kaymadan ilerler", () => {
    vi.useFakeTimers();
    const book: Book = {
      id: "t2",
      title: "t",
      sourceName: "t",
      format: "plainText",
      importedAt: 0,
      fingerprint: "t2",
      sections: [section("A", "bir iki üç dört beş altı yedi sekiz dokuz on")],
      progress: { sectionIndex: 0, wordIndex: 0 },
      preferences: {
        ...defaultPreferences,
        wordsPerMinute: 1200,
        chunkMode: 2,
        sentencePause: 0,
        commaPause: 0,
        paragraphPause: 0,
        longWordPause: 0,
      },
      isFavorite: false,
      notes: [],
    };
    const s = new ReaderSession(book);
    s.play();
    vi.advanceTimersByTime(250);
    expect(s.getSnapshot().wordIndex).toBe(4);
    s.pause();
    expect(s.getSnapshot().sessionWords).toBe(4);
    expect(s.remaining().document).toBeCloseTo(0.3, 5);
    s.dispose();
  });
});
