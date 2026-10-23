// Türkçe metin kuralları: kısaltmalar, sıra sayıları, cümle sonu, bağlaç ve edatlar.
// Bu modül fork'ta yeni yazılmıştır (Rapid Reader veya speeedy kodundan alınmamıştır).

/** Noktası cümle sonu sayılmayan kısaltmalar (küçük harf, sondaki nokta olmadan). */
export const ABBREVIATIONS = new Set([
  // Atıf ve kaynakça
  "bkz",
  "bk",
  "krş",
  "karş",
  "kr",
  "s",
  "ss",
  "sy",
  "syf",
  "c",
  "vd",
  "vdd",
  "vb",
  "vbg",
  "vs",
  "örn",
  "ör",
  "yay",
  "haz",
  "çev",
  "der",
  "ed",
  "eds",
  "bs",
  "b",
  "y",
  "yy",
  "dn",
  "a.g.e",
  "a.g.m",
  "age",
  "agm",
  "op",
  "cit",
  "ibid",
  "et",
  "al",
  "no",
  "nr",
  "sa",
  "sh",
  "par",
  "para",
  "fık",
  "fn",
  "vol",
  "pp",
  "p",
  "ff",
  "cf",
  "ca",
  "ch",
  "ibd",
  // Hukuk
  "md",
  "mad",
  "m",
  "f",
  "e",
  "k",
  "t",
  "r.g",
  "rg",
  "kht",
  "hd",
  "hgk",
  "cgk",
  "ibk",
  // Unvanlar
  "prof",
  "doç",
  "dr",
  "av",
  "yrd",
  "öğr",
  "gör",
  "arş",
  "uzm",
  "hz",
  "sn",
  "müh",
  "ecz",
  "alb",
  "gen",
  "kur",
  "bşk",
  "bşk.v",
  "mr",
  "mrs",
  "st",
  // Kurum ve diğer
  "a.ş",
  "ltd",
  "şti",
  "tic",
  "san",
  "koll",
  "üniv",
  "ünv",
  "fak",
  "böl",
  "enst",
  "vak",
  "cad",
  "sok",
  "mah",
  "apt",
  "tel",
  "faks",
  "km",
  "cm",
  "mm",
  "kg",
  "gr",
  "yak",
  "yakl",
  "bkn",
  "ilg",
  "ekl",
]);

const CLOSERS = /["'”’»›)\]}]+$/u;
const OPENERS = /^["'“‘«‹([{]+/u;

/** Başındaki ve sonundaki tırnak/parantezleri ayıklar. */
export function strip(word: string) {
  return word.replace(OPENERS, "").replace(CLOSERS, "");
}

/** Sadece harf ve rakamlardan oluşan, Türkçe küçük harfe çevrilmiş çekirdek. */
export function core(word: string) {
  return word
    .replace(/[^\p{L}\p{N}.']/gu, "")
    .replace(/\.+$/u, "")
    .toLocaleLowerCase("tr");
}

/** Bir kelimedeki harf ve rakam sayısı (Unicode kod noktası bazında). */
export function letterCount(word: string) {
  let n = 0;
  for (const ch of word) if (/[\p{L}\p{N}]/u.test(ch)) n++;
  return n;
}

function startsLower(word?: string) {
  if (!word) return false;
  const first = Array.from(word.replace(OPENERS, ""))[0] ?? "";
  return /\p{Ll}/u.test(first);
}
function startsDigit(word?: string) {
  return !!word && /^\p{N}/u.test(word.replace(OPENERS, ""));
}

/** Nokta ile biten bir kelimenin kısaltma olup olmadığı. */
export function isAbbreviation(word: string) {
  const w = strip(word);
  if (!w.endsWith(".")) return false;
  const c = core(w);
  if (!c) return false;
  if (ABBREVIATIONS.has(c)) return true;
  // Tek harfli baş harfler (A. B. Yılmaz) ve noktalı kısaltmalar (R.G., a.g.e.)
  if (/^\p{L}$/u.test(c)) return true;
  if (/^(\p{L}{1,3}\.)+\p{L}{1,3}$/u.test(c)) return true;
  return false;
}

/**
 * Kelime cümleyi bitiriyor mu? `next` verilirse bağlama göre karar verilir:
 * kısaltmalar, Türkçe sıra sayıları ("7. madde") ve küçük harfle devam eden
 * metinler cümle sonu sayılmaz.
 */
export function isSentenceEnd(word: string, next?: string) {
  const w = word.replace(CLOSERS, "");
  if (/[!?…]$/u.test(w)) return !startsLower(next);
  if (!w.endsWith(".")) return false;
  if (w.endsWith("..")) return !startsLower(next); // üç nokta
  if (next === undefined) return true;
  if (startsLower(next)) return false;
  if (isAbbreviation(word)) return false;
  const c = core(w);
  // Sıra sayısı: "7." sonrasında rakam veya küçük harf varsa devam eder.
  if (/^\p{N}+$/u.test(c) && startsDigit(next)) return false;
  // Madde numaraları "7/2." gibi ifadelerde aynı kural.
  if (/^[\p{N}/.-]+$/u.test(c) && startsDigit(next)) return false;
  return true;
}

/** Virgül, noktalı virgül veya iki nokta ile biten yan cümle sonu. */
export function isClauseEnd(word: string) {
  const w = word.replace(CLOSERS, "");
  return (
    /[,;:–—]$/u.test(w) ||
    (/[)\]”"»]$/u.test(word) && !/[.!?]/u.test(w.slice(-1)))
  );
}

/** Öbek modunda yeni grubu başlatan bağlaçlar. */
export const CONJUNCTIONS = new Set([
  "ve",
  "veya",
  "veyahut",
  "yahut",
  "ya",
  "ile",
  "ama",
  "fakat",
  "ancak",
  "lakin",
  "çünkü",
  "zira",
  "oysa",
  "oysaki",
  "halbuki",
  "hâlbuki",
  "ise",
  "hem",
  "ne",
  "yani",
  "üstelik",
  "ayrıca",
  "dahi",
  "hatta",
  "ki",
  "eğer",
  "şayet",
  "madem",
  "mademki",
  "sanki",
  "yoksa",
  "and",
  "or",
  "but",
]);

/** Kendinden önceki kelimeye bağlanan ve grubu kapatan edatlar. */
export const POSTPOSITIONS = new Set([
  "için",
  "gibi",
  "kadar",
  "göre",
  "dolayı",
  "ötürü",
  "beri",
  "önce",
  "sonra",
  "üzere",
  "ait",
  "ilişkin",
  "dair",
  "değin",
  "dek",
  "doğru",
  "karşı",
  "rağmen",
  "karşın",
  "itibaren",
  "itibariyle",
  "bakımından",
  "açısından",
  "yönünden",
  "nedeniyle",
  "sebebiyle",
  "dolayısıyla",
  "sayesinde",
  "yoluyla",
  "olarak",
  "üzerine",
  "hakkında",
  "boyunca",
  "süresince",
  "esnasında",
  "sırasında",
]);

/** Önceki kelimeye bağlanan ama grubu kapatmayan ekler/edatlar. */
export const CLITICS = new Set(["de", "da", "mi", "mı", "mu", "mü", "bile"]);

/** Bağlaç/edat karşılaştırması için çekirdek kelime. */
export function bare(word: string) {
  return strip(word)
    .replace(/[.,;:!?…]+$/u, "")
    .toLocaleLowerCase("tr");
}

/** Sayı, sıra sayısı veya madde numarası mı? ("2577", "7.", "7/2.") */
export function isNumberLike(word: string) {
  return /^[\p{N}][\p{N}/.,-]*$/u.test(strip(word));
}

/** Türkçeye duyarlı büyük/küçük harf ve aksan katlama (arama için). */
export function foldTurkish(text: string) {
  return text
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i");
}
