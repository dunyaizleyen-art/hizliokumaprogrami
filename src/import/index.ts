import JSZip from "jszip";
import { normalize, splitSections } from "../core/text";
import type { ImportedDocument } from "../core/types";
import { articleText, parseHTML } from "./html";
import { importEPUB } from "./epub";
import { rtfText } from "./rtf";
import { validateZip } from "./zip";
import { markdownText } from "./markdown";

export interface ImportOptions {
  /** PDF dipnotlarını ayıkla */
  footnotes: boolean;
}

export const supportedFiles =
  ".epub,.pdf,.docx,.rtf,.html,.htm,.xhtml,.md,.markdown,.txt,.text";
export function importText(text: string, title?: string): ImportedDocument {
  // Yapıştırılan metin Markdown içeriyorsa işaretleri ayıkla.
  const markdown =
    /(^|\n)\s*(#{1,6}\s|>\s|```)|\*\*\S|\[[^\]]+\]\(|\[\^\d+\]/.test(text);
  const body = normalize(markdown ? markdownText(text) : text);
  const name =
    title?.trim() ||
    body
      .split("\n")[0]
      .replace(/^#{1,6}\s*/, "")
      .slice(0, 80) ||
    "Yapıştırılan metin";
  return {
    title: name,
    sourceName: "Pano",
    format: "plainText",
    sections: splitSections(body, name),
  };
}
export async function importFile(
  file: File,
  progress?: (message: string) => void,
  options: ImportOptions = { footnotes: true },
): Promise<ImportedDocument> {
  if (file.size > 100 * 1024 * 1024)
    throw new Error("100 MB'tan küçük bir dosya seçin.");
  const ext = file.name.split(".").at(-1)?.toLowerCase();
  const title = file.name.replace(/\.[^.]+$/, "");
  progress?.(`${file.name} okunuyor...`);
  if (ext === "epub") return importEPUB(file);
  if (ext === "pdf") {
    const { importPDF } = await import("./pdf");
    return importPDF(file, progress, options);
  }
  if (ext === "docx") {
    const zip = await JSZip.loadAsync(file);
    validateZip(zip);
    const source = await zip.file("word/document.xml")?.async("string");
    if (!source) throw new Error("Bu Word belgesinde metin bulunamadı.");
    const doc = new DOMParser().parseFromString(source, "application/xml");
    if (doc.querySelector("parsererror"))
      throw new Error("Bu Word belgesi okunamadı.");
    const paragraphText = (node: Node): string => {
      if (node.nodeType !== 1) return "";
      const element = node as Element;
      if (element.localName === "t") return element.textContent ?? "";
      if (element.localName === "tab") return " ";
      if (element.localName === "br" || element.localName === "cr") return "\n";
      return [...element.childNodes].map(paragraphText).join("");
    };
    const text = [...doc.getElementsByTagNameNS("*", "p")]
      .map(paragraphText)
      .join("\n\n");
    return {
      title,
      sourceName: file.name,
      format: "docx",
      sections: splitSections(text, title),
    };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = new TextDecoder().decode(bytes);
  if (text.includes("\ufffd"))
    text = new TextDecoder("windows-1252").decode(bytes);
  if (ext === "rtf")
    return {
      title,
      sourceName: file.name,
      format: "rtf",
      sections: splitSections(rtfText(text), title),
    };
  if (["html", "htm", "xhtml"].includes(ext ?? "")) {
    const doc = parseHTML(text);
    const name = doc.title.trim() || title;
    return {
      title: name,
      sourceName: file.name,
      format: "html",
      sections: splitSections(articleText(doc), name),
    };
  }
  if (!["txt", "text", "md", "markdown"].includes(ext ?? ""))
    throw new Error(
      `.${ext ?? ""} biçimi desteklenmiyor. PDF, EPUB, Markdown, TXT, Word, RTF veya HTML seçin.`,
    );
  return {
    title,
    sourceName: file.name,
    format: ext === "md" || ext === "markdown" ? "markdown" : "plainText",
    sections: splitSections(
      ext === "md" || ext === "markdown" ? markdownText(text) : text,
      title,
    ),
  };
}
