import { section, splitSections } from "../core/text";
import type { ImportedDocument } from "../core/types";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { buildLines, cleanPages, joinPages, type PdfPage } from "./pdf-clean";

GlobalWorkerOptions.workerSrc = workerURL;

export async function importPDF(
  file: File,
  progress?: (message: string) => void,
  options: { footnotes: boolean } = { footnotes: true },
): Promise<ImportedDocument> {
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useSystemFonts: true,
  });
  let passwordProtected = false;
  task.onPassword = (_update: (password: string) => void) => {
    passwordProtected = true;
    void task.destroy();
  };
  let pdf;
  try {
    pdf = await task.promise;
  } catch (error) {
    if (passwordProtected || (error as Error).name === "PasswordException")
      throw new Error(
        "Bu PDF parola korumalı. İçe aktarmadan önce kilitsiz bir kopyasını kaydedin.",
      );
    throw new Error(
      "Bu PDF okunamadı. Yeni bir kopyasını dışa aktarmayı deneyin.",
    );
  }
  try {
    if (pdf.numPages > 3000)
      throw new Error(
        "Bu PDF 3.000 sayfadan uzun. Daha küçük parçalar halinde içe aktarın.",
      );
    const pages: PdfPage[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      progress?.(`PDF sayfası okunuyor: ${i} / ${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const t = item.transform;
        items.push({
          str: item.str,
          x: t[4],
          y: t[5],
          width: item.width,
          height: item.height || Math.hypot(t[2], t[3]),
        });
      }
      pages.push({
        lines: buildLines(items, options.footnotes),
        height: page.view[3] - page.view[1],
      });
      page.cleanup();
      // İçe aktarma ilerlemesinin ekrana yansıması için ara ver.
      if (i % 5 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const cleaned = cleanPages(pages, options);
    const chapters: { page: number; title: string }[] = [];
    type Outline = {
      title: string;
      dest: string | unknown[] | null;
      items: Outline[];
    };
    const visit = async (items: Outline[]) => {
      for (const item of items) {
        try {
          const dest =
            typeof item.dest === "string"
              ? await pdf.getDestination(item.dest)
              : item.dest;
          if (dest?.length && item.title.trim()) {
            const ref = dest[0];
            const index =
              typeof ref === "number"
                ? ref
                : await pdf.getPageIndex(ref as { num: number; gen: number });
            if (index >= 0 && index < cleaned.length)
              chapters.push({ page: index, title: item.title.trim() });
          }
        } catch {
          /* Çözülemeyen ana hat girdileri PDF'in okunmasını engellemez. */
        }
        await visit(item.items ?? []);
      }
    };
    await visit(((await pdf.getOutline()) ?? []) as Outline[]);
    chapters.sort((a, b) => a.page - b.page);
    const unique = chapters.filter(
      (c, i) => i === 0 || c.page !== chapters[i - 1].page,
    );
    if (unique.length && unique[0].page > 0)
      unique.unshift({ page: 0, title: "Başlangıç" });
    const info = (await pdf.getMetadata()).info as {
      Title?: string;
      Author?: string;
    };
    const title = info?.Title?.trim() || file.name.replace(/\.pdf$/i, "");
    const sections =
      unique.length > 1
        ? unique.map((c, i) =>
            section(
              c.title,
              joinPages(
                cleaned.slice(c.page, unique[i + 1]?.page ?? cleaned.length),
              ),
            ),
          )
        : splitSections(joinPages(cleaned), title);
    return {
      title,
      author: info?.Author?.trim() || undefined,
      sourceName: file.name,
      format: "pdf",
      sections: sections.filter((s) => s.wordCount > 0),
    };
  } finally {
    await task.destroy();
  }
}
