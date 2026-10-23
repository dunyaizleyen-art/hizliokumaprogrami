# RSVP Hızlı Okuma Aracı: Referans Repo Analizi ve Karar

Tarih: 2026-10-18
Klonlar: `C:\Users\Boschnak\Desktop\rsvp-referans\` (değiştirilmedi; derleme denemesi scratchpad'deki bir kopyada yapıldı)
Proje klasörü: `C:\Users\Boschnak\Desktop\rsvp-okuyucu\`

Yalnızca README'ler değil, her reponun kaynak kodu okundu: okuma motoru, belgeden metin çıkarma, kelimelere bölme (tokenizasyon), depolama ve klavye işleyicileri. Türkçe davranışı gerçek bir örnek cümleyle, her reponun kendi bölme mantığı Node 24 üzerinde çalıştırılarak test edildi (bkz. §2).

---

## 1. Repo bazında değerlendirme

### 1.1 Axym-Labs/LetoReader

| Başlık | Bulgu (kaynak dosya) |
|---|---|
| Yığın | C# / .NET 8, **Blazor Server**, MudBlazor, Docker. Tarayıcıda değil sunucuda çalışır; arayüz SignalR ile bağlanır. |
| Son commit | 2024-11-10 (yaklaşık 2 yıldır hareketsiz), 267 commit |
| Lisans | **GPL-3.0**. Kod alınırsa yeni uygulamanın tamamı GPL-3 olmak zorunda kalır. Üstelik dil C#; TS tabanlı bir web uygulamasına doğrudan taşınamaz. → **Yalnızca fikir.** |
| Girdi | `FileImporter.cs`: TXT, EPUB (EpubSharp), MD (MarkedNet→HTML→metin), PDF (PdfPig, sayfa sayfa düz metin), HTML; panodan yapıştırma; URL kazıma (`WebExtractor.cs`, sunucu tarafında); RSS. DOCX yok. |
| Hız | `ReaderConfig.ReadingSpeed` varsayılan 300. Sabit aralıklı döngü kullanılıyor (`Task.Delay(60/WPM)`); hız değişikliği okuma yeniden başlatılana kadar uygulanmıyor. Kademeli hızlanma **yok**. |
| Gruplama | **Yok**, yalnızca tek kelime. |
| ORP | Harfin tam ortası vurgulanıyor (`GetCurrentTextPiece`: `(len+1)/2-1`). Göz tanıma noktası değil, geometrik merkez. Uzun Türkçe kelimelerde odak 13. harfe düşüyor. |
| Duraksama | **Yok**: noktalama, paragraf ya da uzun kelime için ek süre verilmiyor. |
| Türkçe | Boşluğa göre bölüyor; Türkçe karakterleri bozmuyor. `WordCharLimit=30` sınırı 30 karakteri aşan kelimeleri ikiye kesiyor (kesme kodunda da bir hata var: `Length-1`). "değerlendirilebileceğinden" (26 karakter) bu yüzden bölünmüyor. |
| Bağlam/geri sarma | Okunan kelimenin solunda ve sağında 12 karakterlik "çevresel" metin gösteriliyor. ←/→ ile 10 kelime atlanıyor. Cümle başına dönme yok. Tam metinden tıklayarak devam etme yok. |
| İlerleme/kütüphane | `StateManager`: birden fazla metin ve konumları tarayıcının localStorage'ında tutuluyor; kaydedilmiş metinler listesi var. Yer imi yok. |
| Yerellik | ❌ Dosyalar sunucuda işleniyor. `Log.PostToCentralLog` merkezi bir log uç noktasına HTTP POST gönderiyor; `AnnouncementsRetriever` uzak sunucudan duyuru çekiyor. Barındırılan sürüm web analitiği kullanıyor (Impressum'da belirtilmiş). |
| Kod kalitesi | Orta düzeyde. Gereksiz bağımlılıklar var (EF Core, SQL Server, Npgsql, Identity), birim testi yok, `Program.cs` içinde `Log.Warning("Test")` kalmış. |

### 1.2 sami-29/speeedy

| Başlık | Bulgu |
|---|---|
| Yığın | TypeScript, **Lit** web bileşenleri, Vite 8, Tailwind 4 ve DaisyUI, IndexedDB (`idb`), PWA. Cloudflare'de barındırılıyor (`wrangler.toml`). |
| Son commit | 2026-09-02, 20 commit (sürüm 1.2.0) |
| Lisans | **MIT**. Telif bildirimi korunarak kod alınabilir. |
| Girdi | `text-parser.ts`: PDF (pdf.js), EPUB (JSZip ile elle ayrıştırma), DOCX (mammoth), DOC, RTF, ODT, HTML, CSV, TXT; global yapıştırma (paste) dinleyicisi. URL desteği yok. MD düz metin olarak okunuyor. |
| Hız | 50–1600 WPM; ↑/↓ ile ±25 ve anlık uygulanıyor (`setWpm` zamanlayıcıyı yeniden kuruyor). "Smart speed" kısa ve sık kelimeleri hızlandırıp uzun kelimeleri yavaşlatıyor. Sık kelime listesi İngilizce ve Slav dilleri için; Türkçe yok. Kademeli hızlanma **sabit 30 kelime** içinde başlangıç WPM'den hedefe çıkıyor (süreye göre ayarlanamıyor). |
| Gruplama | Sabit N = 1–5 kelime. Anlamsal öbek gruplaması **yok**. |
| ORP | `computeOrp`: baştaki ve sondaki noktalamayı atlıyor, harf sayısına göre pivot seçiyor (1/≤5/≤9/10+ → 0/1/2/3), Unicode birleşik işaretleri (combining marks) koruyor. Pivot konumu kaydırılabiliyor ve sabit odak hizası var. Üç repo içinde **en sağlam ORP** bu. |
| Duraksama | Cümle sonunda ×2, virgülde ×1,4 (ayarlanabilir çarpanla), paragraf başında ayrı çarpan, parantez veya tırnak kapanışında ×1,15. Uzun kelime için yalnızca "smart speed" var (sabit oranlı). |
| Türkçe | ⚠️ `Intl.Segmenter` + `navigator.language` kullanıyor. Testte açılış parantezi ve tırnak bir **önceki kelimeye yapıştı** (`ekonomik(`, `kararı12)“`), `sosyo-ekonomik` ve `7/2` ikiye bölündü. Kısaltmalar ("s.", "bkz.", "md.") cümle sonu sayılıp gereksiz duraksamaya yol açıyor. |
| Bağlam/geri sarma | Duraklatınca **tam metin veya ±40 kelimelik bağlam görünümü** açılıyor; tıklanan kelimeden devam ediliyor (`renderPausedText`). Ayarlanabilir adımla geri sarma var. Cümle başına dönme yok. |
| İlerleme/kütüphane | IndexedDB'de en fazla N belge, `resumeWordIndex` ile kaldığı yer, oturum istatistikleri (WPM, süre, seri). Yer imi yok. |
| Ek | `stripCitations`: köşeli parantezli atıfları ([1]) ve yazar-yıl atıflarını (Smith, 2020) siliyor. Yazar-yıl regex'i Türkçe büyük harfleri (Ç, Ş, Ö…) tanımıyor. PDF'de üstbilgi, altbilgi ve sayfa numarası temizliği **yok**. |
| Yerellik | ❌ `index.html` içinde **Umami analitik** betiği var (`cloud.umami.is`); uygulama boyunca `trackEvent` çağrılıyor. Geri bildirim formu Formspree'ye `fetch` yapıyor. Belge içeriği gönderilmiyor ama telemetri var. Bunlar kaldırılabilir. |
| Kod kalitesi | İyi: birim testleri, e2e/a11y testleri, Biome. Ancak `rsvp-reader.ts` 1422 satırlık tek dosya ve projede okumayla ilgisiz çok şey var: pazarlama sayfaları, bağış, profil, pomodoro, ortam sesi, Irlen ve disleksi modları, paylaşım kartı. |

### 1.3 Zer0codestuff/Rapid-Reader

| Başlık | Bulgu |
|---|---|
| Yığın | Asıl ürün **macOS/SwiftUI** uygulaması. Kök dizinde Swift Package var. Ayrıca `web/` alt klasöründe **React 19 + TypeScript + Vite 7** ile yazılmış bağımsız bir tarayıcı sürümü bulunuyor (2026-10-07'de eklendi). URL içe aktarma için küçük bir Express sunucusu da var. |
| Son commit | 2026-10-07, 39 commit; aktif geliştiriliyor |
| Lisans | **MIT**. Kod alınabilir. |
| Girdi (web) | `src/import/*`: EPUB, PDF, DOCX, RTF, HTML, MD, TXT; **metin yapıştırma** diyaloğu; URL (sunucu `/api/article` üzerinden Readability ile). |
| Hız | 100–**900** WPM (`clampPreferences`). ↑/↓ ile ±25, ekranda geçici hız göstergesi (HUD) beliriyor. **Süreye dayalı** kademeli hızlanma var (`rampUpSeconds` 0–10 sn). Ancak hızlanma her zaman hedefin %50'sinden başlıyor; başlangıç WPM'i ayrıca ayarlanamıyor. |
| Gruplama | Sabit N = 1–4. Öbek modu yok. |
| ORP | `pivot()`: kod noktası (`Array.from`) bazlı, uzunluğa göre 0–4 indeksli. Sabit odak çizgileri var (`focus-guide`). Baştaki parantez veya tırnak sayıma dahil ediliyor; bu açıdan speeedy'den zayıf. |
| Duraksama | Noktalamada ×1,8 ve ×1,35; uzun kelimede 8 harften sonraki her harf için +%5 (en fazla +%60). Açılıp kapatılabiliyor ama **miktarları ayarlanamıyor**. Paragraf duraksaması yok. |
| Zamanlayıcı | `ReaderSession.schedule()` **son tarih (deadline) tabanlı**, kayma (drift) yapmıyor. 600–1200 WPM'de tutarlı ritim için kritik. |
| Türkçe | Boşluğa göre bölüyor (`/\S+/gu`) ve her kelimenin metindeki başlangıç ve bitiş konumunu saklıyor. Testte `sosyo-ekonomik`, `(bkz.`, `7/2.`, `Kanun'un` doğru tek parça kaldı. Yalnızca arama fonksiyonu `toLocaleLowerCase("en")` kullanıyor; İ/ı için küçük bir düzeltme gerekiyor. |
| PDF | `cleanPDFPages`: sayfaların en az %70'inde tekrar eden ilk ve son satırları (üstbilgi ve altbilgi) ve sayfa numarası satırlarını siliyor, satır sonu tirelerini birleştiriyor (`(\p{Ll})-\n(\p{Ll})`), PDF ana hattından bölüm çıkarıyor. Dipnot numarası ve dipnot gövdesi temizliği **yok**. Sayfa numarası regex'i yalnızca İngilizce ("Page 3", "3 of 10"). |
| Bağlam/geri sarma | Okunan grubun iki yanında 5'er kelimelik bağlam satırı; ←/→ ile bir grup ileri veya geri; devam ederken N kelime geri sarma (`resumeRewindWords`). Belge içi arama sonuçlarından ilgili kelimeye atlanabiliyor. Duraklatınca tam metin görünümü ve cümle başına dönme **yok**. |
| İlerleme/kütüphane | ✅ En güçlüsü. IndexedDB'de `books`, `contents`, `settings`, `statistics` ve `backups` depoları; bölüm ve kelime bazında ilerleme; kütüphane kenar çubuğu; notlar; dışa ve içe aktarma (yedek); tekrar eden içe aktarmayı engelleme. |
| İstatistik | `onSegment`: yalnızca oynatma süresi ve gösterilen kelime sayısı kaydediliyor, yani **duraklamalar hariç gerçek WPM**. Günlük istatistik ekranı var. |
| Yerellik | ✅ Analitik ve telemetri yok. CSP `connect-src 'self'`. Dosyalar tarayıcıda işleniyor ("Files and pasted text stay on this device"). Dışarıya giden tek istek, kullanıcı URL girerse yerel Express sunucusunun o sayfayı çekmesi. Çevrimdışı çalışma için service worker üretiliyor (`script/offline.mjs`). |
| Kod kalitesi | İyi: TypeScript strict, Vitest ile 23 test, modüler yapı (`core/`, `import/`, `components/`). Scratchpad'deki kopyada `npm ci` + `tsc -b` + `vitest` → **23/23 geçti**. |

---

## 2. Türkçe bölme testi (gerçek çalıştırma)

Girdi:
`İdarenin değerlendirilebileceğinden, Türkiye'nin sosyo-ekonomik (bkz. AYM kararı12) “Danıştay” 2577 s. Kanun'un 7/2. maddesi; çağdaş ŞÜPHE ığdır.`

| Repo | Çıktı (sorunlu parçalar kalın) |
|---|---|
| speeedy (`Intl.Segmenter`) | … **`sosyo-`, `ekonomik(`** , `bkz.` … **`kararı12)“`**, `Danıştay”` … **`7/`, `2.`** … |
| Rapid-Reader (`\S+`) | `sosyo-ekonomik`, `(bkz.`, `kararı12)`, `“Danıştay”`, `7/2.` ✔ |
| LetoReader (boşluk) | Rapid-Reader ile aynı ✔ |

Hiçbir repo şu üç durumu çözmüyor:
- `kararı12` içindeki dipnot numarası temizlenmiyor.
- `s.`, `bkz.`, `md.`, `vd.` gibi kısaltmalar cümle sonu sayılıyor.
- Türkçe sıra sayıları (`7.` madde) cümle sonu sayılıyor.

Bunlar Aşama 2'de Türkçeye özel olarak eklenecek.

---

## 3. Karşılaştırma tablosu

| Özellik | LetoReader | speeedy | Rapid-Reader (web) | İhtiyaç |
|---|---|---|---|---|
| Lisans | GPL-3 ⚠️ | MIT ✅ | MIT ✅ | Kod alınabilir olmalı |
| Platform | Blazor Server ❌ | Tarayıcı ✅ | Tarayıcı ✅ | Tarayıcı, tek komut |
| Son commit | 2024-11 ❌ | 2026-09 ✅ | 2026-10 ✅ | |
| PDF | ✅ (temizlik yok) | ✅ (temizlik yok) | ✅ + üstbilgi/altbilgi/sayfa no + tire birleştirme | + dipnot |
| EPUB | ✅ | ✅ | ✅ (bölümlü) | ✅ |
| Yapıştırma | ✅ | ✅ | ✅ | ✅ |
| MD | ✅ (HTML'e çevirerek) | düz metin | düz metin + `#` başlıkları bölüm yapıyor | ✅ |
| DOCX / URL | ❌ / ✅ | ✅ / ❌ | ✅ / ✅ (sunucu) | Gerekli değil |
| WPM aralığı | serbest, sabit | 50–1600 | 100–900 | **100–1200** |
| Anlık hız (klavye) | ❌ | ✅ | ✅ + HUD | ✅ |
| Kademeli hızlanma | ❌ | 30 kelime sabit | 0–10 sn, %50'den | **başlangıç→hedef, süre ayarlı** |
| Gruplama | 1 | 1–5 | 1–4 | **1/2/3 + öbek modu** |
| ORP | geometrik orta | ✅ en iyi | iyi | ✅ sabit odak |
| Noktalama duraksaması | ❌ | ✅ ayarlı | ✅ sabit | **ayarlı** |
| Paragraf duraksaması | ❌ | ✅ | ❌ | **ayarlı** |
| Uzun kelime duraksaması | ❌ | kısmen | ✅ sabit | **ayarlı** |
| Türkçe bölme | ✅ | ⚠️ hatalı | ✅ | ✅ + kısaltma + dipnot |
| Duraklatınca tam metin + tıkla-devam et | ❌ | ✅ | ❌ (5 kelimelik satır) | ✅ |
| 1 cümle geri | ❌ | ❌ | ❌ | ✅ |
| Kütüphane + belge bazlı ilerleme | kısmen | kısmen (N belge) | ✅ | ✅ |
| Kalan süre | ✅ basit | ✅ ayrıntılı | ✅ basit | ✅ |
| Gerçek WPM (duraklamalar hariç) | ❌ | oturum bazlı | ✅ segment bazlı | ✅ |
| Kaymasız zamanlayıcı | ❌ | ❌ (`setTimeout` zinciri) | ✅ deadline | ✅ (1200 WPM için şart) |
| Koyu tema / tam ekran / odak | ✅/✅/✅ | ✅/✅/✅ | ✅/✅/✅ | ✅ |
| Telemetri | ❌ merkezi log + analitik | ❌ Umami + Formspree | ✅ yok | **Yok olmalı** |
| Test | yok | iyi | iyi (23 test, geçti) | |

---

## 4. Karar: **(A) Rapid-Reader'ın `web/` uygulamasını temel al**

**Önerilen:** Rapid-Reader'ın `web/` klasörü (MIT) yeni proje klasörüne alınır (fork). Türkçeye ve akademik okumaya uyarlanarak geliştirilir. Eksik özelliklerin bir kısmı speeedy'den (MIT) uyarlanır. LetoReader'dan kod alınmaz.

### Gerekçe
1. **Altyapı hazır ve sağlam.** Gereksinimlerin en zor ve en riskli kısmı Rapid-Reader web'de zaten çalışıyor: tamamen yerel IndexedDB kütüphanesi, belge ve bölüm bazında ilerleme kaydı, sayfa yenilenince kaldığı yerden devam, duraklamalar hariç gerçek WPM istatistiği, kaymasız deadline zamanlayıcısı, PDF üstbilgi/altbilgi temizliği, yapıştırma ve EPUB/MD girişi, tam ekran, koyu tema, çevrimdışı service worker. Bunları sıfırdan yazmak hem daha uzun sürer hem daha fazla hata riski taşır.
2. **Türkçe metni doğru bölüyor.** Üç repo içinde Türkçe kelime bölme testini sorunsuz geçen ve kelime konumlarını saklayan (bağlam görünümü için gerekli) tek modern yığın bu.
3. **Gizlilik.** Telemetri yok, CSP sıkı. speeedy'de analitik ve dış form, LetoReader'da merkezi log var.
4. **Kod kalitesi ve genişletilebilirlik.** Modüler, strict TypeScript, testli ve derleniyor (23/23 test geçti). speeedy'nin okumayla ilgisiz pazarlama, profil ve bağış katmanlarını ayıklamak, Rapid-Reader'a eksikleri eklemekten daha fazla iş.
5. **Platform şartına uyuyor.** Tarayıcıda çalışıyor, `npm install && npm run dev` ile açılıyor. Kök dizindeki macOS/Swift uygulaması **kullanılmayacak**; yalnızca `web/` alınacak.

### Rapid-Reader web'de eksik kalanlar (Aşama 2'de eklenecek)
| # | Eksik | Kaynak / yaklaşım |
|---|---|---|
| 1 | WPM üst sınırı 900 → **1200** | `clampPreferences` değişikliği |
| 2 | Grup boyutu 1/2/3 + **öbek modu** | Yeni `chunker.ts` (Türkçe bağlaç ve edat kurallarıyla, bkz. §5.3). Fikir: hiçbir repoda yok, özgün. |
| 3 | Kademeli hızlanma: **başlangıç WPM → hedef WPM, X saniyede** | `displayDuration`'daki "%50'den başla" formülü doğrusal enterpolasyonla değiştirilecek. Fikir: speeedy'nin `rampWpm`'i, süre bazlı hale getirilerek. |
| 4 | Noktalama, **paragraf** ve uzun kelime ek sürelerinin **ayarlanabilir** olması | speeedy'nin çarpan modeli (MIT, uyarlama) |
| 5 | Türkçe kısaltma ve sıra sayısı istisnaları (`s.`, `bkz.`, `md.`, `vd.`, `vb.`, `Prof.`, `Dr.`, `E.`, `K.`, `7.` …) | Yeni, özgün liste |
| 6 | ORP: baştaki noktalamayı atlayan pivot ve gruplarda pivot | speeedy `computeOrp` (MIT) uyarlaması + Rapid'in 0–4 indeks tablosu |
| 7 | **Duraklatınca tam metin bağlam görünümü**, tıklanan kelimeden devam | Fikir ve kısmen kod speeedy `renderPausedText`'ten (MIT). Rapid'in kelime konumlarıyla paragraf düzeni korunacak. |
| 8 | **1 cümle geri sarma** (ve 1 cümle ileri) | Yeni, özgün (`sentenceStart()` yardımcı fonksiyonu) |
| 9 | PDF: **dipnot numaraları** (üst simge rakamlar) ve sayfa altındaki dipnot gövdeleri, Türkçe sayfa numarası kalıpları ("Sayfa 3", "- 3 -", Roma rakamı) | pdf.js öğe yüksekliği ve konumuyla özgün sezgisel kurallar (bkz. §5.4) |
| 10 | Kalan süre tahmini, duraksama ve grup ayarları hesaba katılarak | speeedy `getEstimatedRemainingMs` fikri |
| 11 | Ekranda toplam ve oturum **gerçek ortalama WPM** göstergesi | Rapid'in mevcut `statistics` verisinden |
| 12 | Aramada İ/ı küçük harf dönüşümü düzeltmesi | `fold()` içinde `tr` yerel ayarı |

### Fork sırasında kaldırılacaklar (gizlilik ve sadelik)
- **URL içe aktarma ve Express sunucusu** (`server/`, `/api/article`): dış sitelere istek atıyor, listede yok ve tek komutla açılışı karmaşıklaştırıyor. Kaldırılınca 8 paket düşer: `express`, `helmet`, `express-rate-limit`, `ipaddr.js`, `jsdom`, `undici`, `@mozilla/readability`, `concurrently`.
- Uygulama güncelleme denetimi veya dış bağlantı varsa kaldırılacak. GitHub linki yalnızca bir `href`, sorun değil.
- Vite `--host 0.0.0.0` → `127.0.0.1`: geliştirme sunucusu yerel ağa açılmaz.

### Lisans özeti
| Repo | Kod alınabilir mi? | Bu projede kullanım |
|---|---|---|
| Rapid-Reader | ✅ MIT | Temel kod (fork). `LICENSE` korunacak, README'de atıf yapılacak. |
| speeedy | ✅ MIT | `computeOrp`, duraksama çarpanları, duraklatma görünümü fikri ve kısmen kodu. Alınan dosyaların başına MIT bildirimi eklenecek. |
| LetoReader | ⚠️ GPL-3 (ve C#) | **Kod alınmayacak.** Yalnızca fikir: çevresel bağlam kelimeleri, Ctrl+F odak modu. |

---

## 5. Aşama 2 uygulama planı

### 5.1 Dosya yapısı (`C:\Users\Boschnak\Desktop\rsvp-okuyucu\`)
```
rsvp-okuyucu/
├─ README.md                 # kurulum, kullanım, klavye kısayolları (Türkçe)
├─ README_ANALIZ.md          # bu belge
├─ LICENSE                   # MIT (Rapid-Reader telif satırı + yeni telif)
├─ THIRD_PARTY.md            # Rapid-Reader ve speeedy MIT bildirimleri
├─ package.json              # "dev": "vite --host 127.0.0.1 --open"
├─ index.html, vite.config.ts, tsconfig.json, vitest.config.ts
├─ public/manifest.webmanifest
├─ script/offline.mjs        # service worker (Rapid'den)
├─ src/
│  ├─ main.tsx, App.tsx, styles.css
│  ├─ core/
│  │  ├─ types.ts            # Preferences: wpm 100–1200, chunkMode, ramp*, pause*
│  │  ├─ text.ts             # normalize, tokenize (\S+ + konum), pivot/ORP
│  │  ├─ turkish.ts          # YENİ: kısaltmalar, bağlaçlar/edatlar, sentenceEnd()
│  │  ├─ chunker.ts          # YENİ: 1/2/3 sabit + öbek modu → Chunk[]
│  │  ├─ timing.ts           # YENİ: displayDuration (ramp + ayarlı duraksamalar), kalan süre
│  │  ├─ session.ts          # deadline zamanlayıcı; chunk tabanlı; cümle geri/ileri
│  │  ├─ storage.ts          # IndexedDB (Rapid'den, aynen)
│  │  └─ search.worker.ts
│  ├─ import/
│  │  ├─ index.ts            # PDF, EPUB, MD, TXT, yapıştırma (DOCX/RTF/HTML mevcut, korunur)
│  │  ├─ pdf.ts              # + dipnot ve Türkçe sayfa numarası temizliği
│  │  ├─ epub.ts, html.ts, zip.ts, rtf.ts
│  │  └─ markdown.ts         # YENİ: MD işaretlerini (**, _, [](), `, >, tablo) soyma
│  └─ components/
│     ├─ Reader.tsx          # ORP sabit odak, HUD, gerçek WPM göstergesi
│     ├─ ContextView.tsx     # YENİ: duraklatınca tam metin, tıkla-devam et
│     ├─ Options.tsx         # grup modu, ramp, duraksama kaydırıcıları
│     ├─ Sidebar.tsx, ImportDialog.tsx, Statistics.tsx, Settings.tsx, primitives.tsx
└─ tests/
   ├─ turkish.test.ts        # bölme, kısaltma, İ/ı
   ├─ chunker.test.ts        # öbek modu
   ├─ timing.test.ts         # ramp, duraksamalar, 1200 WPM sınırı
   ├─ pdf-clean.test.ts      # üstbilgi, altbilgi, sayfa no, dipnot
   ├─ import.test.ts, reader.test.ts, storage.test.ts (Rapid'den)
   └─ fixtures/ornek.md, ornek.pdf   # Türkçe örnekler (PDF, Edge headless ile üretilecek; yeni paket yok)
```

### 5.2 Kütüphaneler
Rapid-Reader web'den **devralınanlar** (sunucu paketleri çıkarıldıktan sonra):
- Çalışma zamanı: `react`, `react-dom`, `pdfjs-dist` (PDF), `jszip` (EPUB/DOCX), `idb` (IndexedDB), `lucide-react` (ikonlar)
- Geliştirme: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `fake-indexeddb`, `@types/react(-dom)`, `prettier`, `playwright` (tarayıcı testi)

**Yeni bağımlılık: 0.** Markdown soyma, öbek modu, Türkçe kurallar ve dipnot temizliği küçük, özgün TS modülleri olarak yazılacak. Font paketi eklenmeyecek; Türkçe glifleri tam olan sistem fontları kullanılacak (Segoe UI / Inter / system-ui; okuma alanı için isteğe bağlı serif).

Not: Kullanıcının npm yapılandırması `esbuild` kurulum betiğini (postinstall) engelliyor (`allow-scripts` uyarısı). Testler yine de çalıştı. `vite dev` etkilenirse README'ye `npm approve-scripts esbuild` adımı eklenecek. Gerekirse size soracağım.

### 5.3 Öbek modu (Türkçe kurallar)
Bir grup en fazla 3 kelime ve yaklaşık 22 harften oluşur. Kurallar:
- Grup **noktalamadan sonra kapanır** (`. , ; : ? ! )` ve kapanış tırnağı).
- Grup bir **bağlaçtan önce kapanır**: `ve, veya, ya da, ile, ama, fakat, ancak, lakin, çünkü, oysa, ise, hem, ne, ki, yani, dahi, üstelik, bu nedenle…`. Bağlaç bir sonraki grubu başlatır.
- **Edat ve son ekler bir önceki kelimeye bağlanır**: `için, gibi, kadar, göre, rağmen, karşın, dolayı, beri, önce, sonra, üzere, ait, ilişkin, değin, da/de`.
- **Uzun kelime** (13 harf ve üzeri, ör. "değerlendirilebileceğinden") tek başına gösterilir.
- Sayı ile ondan sonraki kelime birlikte tutulur ("2577 sayılı", "7. madde").

### 5.4 PDF temizliği
1. Rapid'in tekrar eden ilk/son satır algılaması korunur. Sayfa numarası kalıplarına Türkçe ve Roma rakamı biçimleri eklenir (`Sayfa 3`, `- 3 -`, `3/120`, `xii`).
2. **Üst simge dipnot numaraları:** pdf.js'te yüksekliği satırın ortanca yüksekliğinin %75'inden küçük olan, taban çizgisinin üstünde duran ve yalnızca rakam ya da `*†‡` içeren öğeler atılır.
3. **Dipnot gövdeleri:** sayfanın alt %35'inde, ana gövde fontundan küçük puntoyla ve rakamla başlayan satır blokları atılır. Bu davranış ayarlardan kapatılabilir (varsayılan: açık).
4. Satır sonu tireleri birleştirilir (Rapid). Yumuşak tire (`\u00AD`) silinir.

### 5.5 Klavye kısayolları (plan)
| Tuş | İşlev |
|---|---|
| Space | Oynat / duraklat (duraklatınca bağlam görünümü açılır) |
| ↑ / ↓ | +25 / −25 WPM (Shift ile ±100) |
| ← / → | Bir grup geri / ileri |
| Shift+← / Shift+→ | **1 cümle geri** / 1 cümle ileri |
| 1 / 2 / 3 / 4 | Grup boyutu 1 / 2 / 3 / öbek modu |
| F | Tam ekran odak modu (Esc ile çıkış) |
| C | Bağlam görünümünü aç / kapat |
| Ctrl+F | Belgede ara |

### 5.6 Özellik listesi (öncelik sırasıyla)
1. **Fork ve sadeleştirme:** `web/` kopyalanır, sunucu ve URL içe aktarma kaldırılır, `npm install && npm run dev` tek komutla açılır, testler yeşil.
2. **Türkçe metin çekirdeği:** `turkish.ts` (kısaltma ve sıra sayısı istisnaları, `sentenceEnd`), aramada İ/ı düzeltmesi, testler.
3. **Zamanlama:** WPM 100–1200, ayarlanabilir noktalama/paragraf/uzun kelime ek süresi, başlangıç→hedef kademeli hızlanma, kaymasız zamanlayıcı korunur.
4. **Gruplama:** 1/2/3 ve öbek modu, gruplarda ORP ve sabit odak hizası, uzun kelimede fontun otomatik küçültülmesi.
5. **PDF ve MD temizliği:** dipnot, Türkçe sayfa numarası, MD işaretlerini soyma, Türkçe PDF ve MD örnek dosyaları.
6. **Gezinme:** duraklatınca tam metin bağlam görünümü, tıkla-devam et, 1 cümle geri/ileri.
7. **İlerleme ve istatistik:** belge bazında ilerleme (mevcut; yenileme testi), kalan süre tahmini, gerçek ortalama WPM göstergesi.
8. **Arayüz:** koyu tema varsayılan, büyük okunaklı font, tam ekran odak modu, klavye kısayolları. Arayüz metinleri Türkçeleştirilir.
9. **README.md** (kurulum, kullanım, kısayollar) ve uçtan uca doğrulama: örnek PDF ve MD dosyaları 600 WPM'de 2 kelimelik gruplarla okunur, Türkçe karakter kontrolü, yenileme sonrası ilerleme kontrolü.

### 5.7 Onayınızı beklediğim noktalar
- **Karar A** (Rapid-Reader `web/` fork) uygun mu?
- Fork'ta zaten bulunan ama listenizde olmayan yerel özellikler: **DOCX/RTF/HTML içe aktarma, notlar, belge içi arama, yedek dışa/içe aktarma**. Bunlar ek bağımlılık ve ağ erişimi gerektirmiyor. Plan: **korumak**. İsterseniz kaldırırım.
- **URL içe aktarma ve sunucunun kaldırılması** uygun mu? Plan: kaldırmak.
- **Arayüzün Türkçeleştirilmesi** uygun mu? Plan: evet.
