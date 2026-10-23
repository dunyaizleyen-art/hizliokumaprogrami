import type JSZip from "jszip";

// JSZip 3 exposes the declared unpacked size on loaded entries before inflation.
// Bound it before reading XML or cover data, then also check the extracted text.
export function validateZip(zip: JSZip) {
  const entries = Object.values(zip.files);
  if (entries.length > 10000)
    throw new Error("Bu belge çok fazla dosya içeriyor.");
  let total = 0;
  for (const entry of entries) {
    const size =
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data
        ?.uncompressedSize ?? 0;
    if (size > 30_000_000)
      throw new Error(
        "Belgenin içindeki bir dosya içe aktarılamayacak kadar büyük.",
      );
    total += size;
    if (total > 250_000_000)
      throw new Error(
        "Bu belge açıldığında çok büyük oluyor. Daha küçük bir kopyasını içe aktarın.",
      );
  }
}
