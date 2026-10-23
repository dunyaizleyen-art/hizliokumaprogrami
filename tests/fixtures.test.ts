// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  buildLines,
  cleanPages,
  joinPages,
  type PdfPage,
} from "../src/import/pdf-clean";
import { splitSections, tokenize } from "../src/core/text";
import { markdownText } from "../src/import/markdown";
import { chunkEnd } from "../src/core/chunker";

async function pdfText(path: string, footnotes = true) {
  const pdf = await getDocument({
    data: new Uint8Array(readFileSync(path)),
    useSystemFonts: true,
  }).promise;
  const pages: PdfPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => "str" in item)
      .map((item) => {
        const t = item.transform;
        return {
          str: item.str,
          x: t[4],
          y: t[5],
          width: item.width,
          height: item.height || Math.hypot(t[2], t[3]),
        };
      });
    pages.push({ lines: buildLines(items, footnotes), height: page.view[3] });
  }
  return joinPages(cleanPages(pages, { footnotes }));
}

describe("örnek dosyalar", () => {
  it("Türkçe PDF: üstbilgi, sayfa numarası ve dipnotları ayıklar", async () => {
    const text = await pdfText("ornekler/ornek.pdf");
    expect(text).toContain("Ölçülülük İlkesi ve İdari Yargı");
    expect(text).toContain("Değerlendirilebileceğinden");
    expect(text).toContain("Iğdır, Muş ve Şırnak");
    expect(text).not.toContain("Dergisi");
    expect(text).not.toContain("Gözübüyük");
    expect(text).not.toContain("RG. 20.01.1982");
    expect(text).not.toMatch(/\b4[123]\b/);
    // Üst simge dipnot numarası kelimeye yapışmaz
    expect(text).toContain("ifade eder. Bu ilke");
    expect(text).not.toMatch(/eder\.?1/);
    // Sayfa sonunda bölünmeyen cümle birleştirilir, paragraflar korunur
    expect(text.split("\n\n").length).toBeGreaterThanOrEqual(8);
    const tokens = tokenize(text);
    expect(tokens.length).toBeGreaterThan(250);
    for (const ch of "çğıİöşüÇÖŞ") expect(text).toContain(ch);
  });
  it("dipnot ayıklama kapalıyken dipnot metni korunur", async () => {
    const text = await pdfText("ornekler/ornek.pdf", false);
    expect(text).toContain("Gözübüyük");
    expect(text).not.toContain("Dergisi");
  });
  it("Türkçe Markdown: bölümler, dipnot temizliği ve 2'li gruplar", () => {
    const md = readFileSync("ornekler/ornek.md", "utf8");
    const sections = splitSections(markdownText(md), "ornek");
    expect(sections.map((s) => s.title)).toEqual([
      "İdari İşlemlerin Yargısal Denetimi",
      "Sebep Unsuru",
      "Sonuç",
    ]);
    const all = sections.map((s) => s.text).join("\n");
    expect(all).not.toContain("[^");
    expect(all).not.toContain("Gözübüyük");
    expect(all).not.toContain("**");
    const text = sections[0].text;
    const tokens = tokenize(text);
    const pairs: string[] = [];
    for (let i = 0; i < tokens.length; i = chunkEnd(text, tokens, i, 2))
      pairs.push(
        tokens
          .slice(i, i + 2)
          .map((t) => t.text)
          .join(" "),
      );
    expect(pairs[0]).toBe("İdare hukukunda");
    expect(pairs.every((p) => p.split(" ").length <= 2)).toBe(true);
  });
});
