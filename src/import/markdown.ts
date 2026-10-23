// Markdown işaretlerini okunabilir düz metne çevirir. Başlık işaretleri (#)
// korunur; bölümlere ayırma `splitSections` tarafından yapılır.
export function markdownText(source: string): string {
  let text = source.replace(/\r\n?/g, "\n");
  // YAML ön bilgisi
  text = text.replace(/^---\n[\s\S]*?\n---\n/, "");
  // Kod blokları: çitleri kaldır, içeriği koru
  text = text.replace(/^```[^\n]*\n([\s\S]*?)^```\s*$/gm, "$1");
  text = text.replace(/^~~~[^\n]*\n([\s\S]*?)^~~~\s*$/gm, "$1");
  // HTML yorumları ve etiketleri
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, "");
  const lines = text.split("\n").flatMap((raw) => {
    let line = raw;
    // Dipnot tanımları ve referans bağlantı tanımları
    if (/^\s*\[\^[^\]]+\]:/.test(line)) return [];
    if (/^\s*\[[^\]]+\]:\s*\S+/.test(line)) return [];
    // Yatay çizgi ve tablo ayırıcı satırları
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return [""];
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line))
      return [];
    // Setext başlık alt çizgileri
    if (/^\s*(=+|-+)\s*$/.test(line)) return [];
    // Tablo satırları: hücreleri boşlukla birleştir
    if (/^\s*\|.*\|\s*$/.test(line))
      line = line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
        .join(" · ");
    // Alıntı ve liste işaretleri
    line = line.replace(/^\s*(>\s?)+/, "");
    line = line.replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/, "");
    return [line];
  });
  text = lines.join("\n");
  // Satır içi öğeler
  text = text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // görseller
    .replace(/\[\^[^\]]+\]/g, "") // dipnot referansları
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // bağlantılar
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1") // referans bağlantılar
    .replace(/<(https?:\/\/[^>]+)>/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2")
    .replace(
      /(^|[^\p{L}\p{N}*])\*(?=\S)([^*\n]*?\S)\*(?![\p{L}\p{N}])/gu,
      "$1$2",
    )
    .replace(/(^|[^\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}])/gu, "$1$2")
    .replace(/~~(?=\S)([^~\n]*?\S)~~/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "$1");
  return text;
}
