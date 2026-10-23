import { describe, it, expect } from "vitest";
import {
  buildLines,
  cleanPages,
  isPageNumber,
  joinPages,
  type PdfLine,
  type PdfPage,
} from "../src/import/pdf-clean";
import { markdownText } from "../src/import/markdown";
import { importText } from "../src/import";

const line = (text: string, y: number, size = 11, x = 72): PdfLine => ({
  text,
  x,
  y,
  size,
});

function page(n: number, body: string[], footnotes: string[] = []): PdfPage {
  const lines: PdfLine[] = [
    line(`Ankara Hukuk Dergisi Cilt 7 Sayı ${n}`, 780, 9),
  ];
  body.forEach((t, i) => lines.push(line(t, 740 - i * 14)));
  footnotes.forEach((t, i) => lines.push(line(t, 120 - i * 10, 8)));
  lines.push(line(String(n + 100), 40, 9, 300));
  return { lines, height: 842 };
}

describe("PDF temizliği", () => {
  it("üst simge dipnot numarasını satırdan çıkarır, kelimeleri birleştirir", () => {
    const lines = buildLines([
      { str: "İdarenin", x: 72, y: 700, width: 45, height: 11 },
      { str: "kararı", x: 120, y: 700, width: 30, height: 11 },
      { str: "12", x: 150.5, y: 704, width: 6, height: 7 },
      { str: "ile", x: 160, y: 700, width: 14, height: 11 },
      { str: "değerlendi", x: 177, y: 700, width: 50, height: 11 },
      { str: "rilmiştir.", x: 227.2, y: 700, width: 40, height: 11 },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("İdarenin kararı ile değerlendirilmiştir.");
  });
  it("Türkçe ve Roma rakamlı sayfa numaralarını tanır", () => {
    for (const t of ["12", "- 12 -", "Sayfa 3", "s. 45", "3/120", "xii", "IV"])
      expect(isPageNumber(t)).toBe(true);
    for (const t of ["Giriş", "2577 sayılı Kanun", "mill"])
      expect(isPageNumber(t)).toBe(false);
  });
  it("üstbilgi, sayfa numarası ve sayfa altı dipnotları siler; paragrafları akıtır", () => {
    const pages = [1, 2, 3, 4].map((n) =>
      page(
        n,
        [
          "Danıştay, idari işlemin hukuka uygunluğunu denetlerken",
          "kamu yararı ilkesini esas alır ve bu ilke uyarınca karar ve-",
          "rir. Bu yaklaşım yerleşik içtihattır.",
        ],
        [
          "1 Bkz. Danıştay 10. Daire, E. 2019/1, K. 2020/2.",
          "2 Aynı yönde: AYM kararı.",
        ],
      ),
    );
    const text = joinPages(cleanPages(pages, { footnotes: true }));
    expect(text).not.toContain("Dergisi");
    expect(text).not.toContain("Bkz. Danıştay 10");
    expect(text).not.toMatch(/\b10[1-4]\b/);
    expect(text).toContain("karar verir. Bu yaklaşım");
    expect(text.split("\n\n")).toHaveLength(4);
  });
  it("dipnot ayıklama kapalıyken dipnotları korur", () => {
    const pages = ["Birinci", "İkinci", "Üçüncü"].map((w, n) =>
      page(
        n,
        [`${w} sayfanın gövde metni.`, "Devamı."],
        [`1 Dipnot metni ${w}.`],
      ),
    );
    expect(joinPages(cleanPages(pages, { footnotes: false }))).toContain(
      "Dipnot metni",
    );
  });
  it("sayfa sonunda bitmeyen cümleyi bir sonraki sayfayla birleştirir", () => {
    expect(
      joinPages(["Birinci sayfa cümlesi", "devam ediyor.", "Yeni paragraf."]),
    ).toBe("Birinci sayfa cümlesi devam ediyor.\n\nYeni paragraf.");
    expect(joinPages(["değerlendir-", "ilmesi gerekir."])).toBe(
      "değerlendirilmesi gerekir.",
    );
  });
});

describe("Markdown temizliği", () => {
  it("işaretleri ayıklar, başlıkları korur, dipnotları siler", () => {
    const md = [
      "---",
      "title: Deneme",
      "---",
      "# Giriş",
      "",
      "**İdare hukuku**, _kamu_ gücünün [denetimi](https://ornek.org) ile ilgilenir.[^1]",
      "",
      "> Alıntı satırı",
      "- Madde bir",
      "| Sütun | Değer |",
      "|---|---|",
      "| A | B |",
      "",
      "[^1]: Dipnot açıklaması.",
    ].join("\n");
    const text = markdownText(md);
    expect(text).toContain("# Giriş");
    expect(text).toContain(
      "İdare hukuku, kamu gücünün denetimi ile ilgilenir.",
    );
    expect(text).toContain("Alıntı satırı");
    expect(text).toContain("Madde bir");
    expect(text).toContain("A · B");
    expect(text).not.toContain("Dipnot açıklaması");
    expect(text).not.toContain("title:");
    expect(text).not.toContain("snake_case_");
  });
  it("kelime içindeki alt çizgileri korur", () =>
    expect(markdownText("dosya_adi_v2 ve *vurgu*")).toBe(
      "dosya_adi_v2 ve vurgu",
    ));
  it("yapıştırılan Markdown metnini otomatik ayıklar", () => {
    const doc = importText("# Başlık\n\n**Kalın** metin[^1].\n\n[^1]: Not.");
    expect(doc.title).toBe("Başlık");
    expect(doc.sections[0].text).toContain("Kalın metin.");
  });
});
