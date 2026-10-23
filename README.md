# Odak Okuyucu

Türkçe akademik metinler (makale PDF'leri, kitap bölümleri, EPUB, Markdown, hukuk metinleri) için **tamamen yerel ve çevrimdışı** çalışan bir RSVP (Rapid Serial Visual Presentation) hızlı okuma aracı.

- Belgeler bu tarayıcıdan **çıkmaz**: dosyalar tarayıcıda ayrıştırılır, kütüphane tarayıcının IndexedDB deposunda tutulur. Sunucu, hesap, analitik veya telemetri yoktur.
- [Rapid Reader](https://github.com/Zer0codestuff/Rapid-Reader) web uygulamasının (MIT) Türkçeye uyarlanmış bir fork'udur. Ayrıntılar için `README_ANALIZ.md` ve `THIRD_PARTY.md` dosyalarına bakın.

## Kurulum ve çalıştırma

Node.js 20.19 veya üstü gerekir (Node 24 ile test edildi).

```bash
npm install && npm run dev
```

Windows PowerShell'de "running scripts is disabled" hatası alırsanız sistem ayarını değiştirmeden `npm` yerine `npm.cmd` yazın:

```powershell
npm.cmd install; npm.cmd run dev
```

Komut, uygulamayı `http://127.0.0.1:5173` adresinde açar. Sunucu yalnızca bu bilgisayardan erişilebilir; yerel ağa açılmaz.

Diğer komutlar:

| Komut | İşlev |
|---|---|
| `npm test` | Birim testleri (Türkçe bölme, öbek modu, zamanlama, PDF/MD temizliği, depolama) |
| `npm run build` | Tür denetimi + üretim derlemesi (`dist/`, çevrimdışı service worker dahil) |
| `npm run preview` | Derlenmiş sürümü `http://127.0.0.1:4173` adresinde açar |

> npm, `esbuild` paketinin kurulum betiği için bir `allow-scripts` uyarısı gösterebilir. Uygulama bu uyarıya rağmen çalışır. Uyarıyı kaldırmak isterseniz `npm approve-scripts esbuild` komutunu çalıştırın.

## Kullanım

1. **Belge ekle:** Sol üstteki `+` düğmesi, `Ctrl+O` veya dosyayı pencereye sürükleyip bırakma.
   - Desteklenenler: **PDF, EPUB, Markdown, TXT**, ayrıca DOCX, RTF, HTML.
   - **Metin yapıştır:** `Ctrl+Shift+V` veya "Metin yapıştır" sekmesi. Yapıştırılan metindeki Markdown işaretleri otomatik ayıklanır.
   - PDF'lerde üstbilgi, altbilgi ve sayfa numaraları (Türkçe "Sayfa 3", "- 3 -", Roma rakamları dahil) ayıklanır. Üst simge dipnot numaraları ve sayfa altındaki dipnot blokları da varsayılan olarak çıkarılır (Ayarlar → Okuma varsayılanları → İçe aktarma). Satır sonu tireleri birleştirilir, satırlar paragraflara akıtılır. Taranmış (görüntü) PDF'lerde metin olmadığı için önce OCR gerekir.
   - Örnek dosyalar: `ornekler/ornek.pdf` ve `ornekler/ornek.md`.
2. **Oku:** `Space` ile başlatın. Odak harfi (ORP, turuncu) her zaman ekranın ortasındaki iki çizginin arasında kalır.
3. **Duraklat:** `Space`. Duraklatınca tam metin **bağlam görünümü** açılır ve kaldığınız grup vurgulanır. Bir kelimeye tıklayıp `Space` ile oradan devam edebilirsiniz. Bu görünümü `C` ile kapatıp açabilirsiniz.
4. **İlerleme:** Her belgenin konumu otomatik kaydedilir; sayfa yenilense de tarayıcı kapansa da kaldığınız yerden devam eder. Alt çubukta bölüm ve belge için **kalan süre** ve **gerçek hız** (oturum, belge, genel) görünür.

### Okuma seçenekleri (alt çubuktaki ayar simgesi)

| Seçenek | Açıklama |
|---|---|
| Hedef hız | 100–1200 WPM |
| Grup boyutu | 1, 2, 3 kelime veya **Öbek modu**: en fazla 3 kelime; noktalamada ve satır sonunda kesilir, bağlaçlar (ve, ama, çünkü, ile...) yeni grubu başlatır, edatlar (için, gibi, göre, kadar...) önceki kelimeye bağlanır, 13 harf ve üzeri kelimeler ("değerlendirilebileceğinden") tek başına gösterilir, "2577 sayılı" gibi sayılar sonraki kelimeyle birlikte tutulur |
| Kademeli hızlanma | Her başlatışta *başlangıç hızından* hedef hıza belirlenen sürede (0–120 sn) doğrusal olarak çıkar |
| Ek süreler | Cümle sonu, virgül/noktalı virgül/iki nokta, paragraf sonu ve uzun kelime için ayrı ayrı. Değerler bir kelimenin gösterim süresinin yüzdesidir (%100 = bir kelimelik ek bekleme). Kısaltmalar (bkz., s., md., vd., Prof., Dr., R.G. ...) ve sıra sayıları ("7. madde") cümle sonu sayılmaz |
| Bağlam | Duraklatınca tam metin, odak kelimenin çevresindeki kelimeler, okurken çevreyi gizleme, devam ederken N kelime geri sarma |
| Görünüm | Koyu (varsayılan), açık, sepya veya sistem teması; 42–140 px yazı boyutu |

Her belge kendi okuma seçeneklerini saklar. Yeni belgeler için varsayılanlar **Ayarlar → Okuma varsayılanları** bölümünden belirlenir.

### Gerçek WPM nasıl hesaplanır?

Yalnızca **aktif oynatma süresi** sayılır (duraklatılmış süreler hariç). Noktalama ve paragraf ek süreleri okuma süresine dahildir. Bu nedenle gerçek hız, hedef hızın biraz altında çıkar. Günlük toplamlar sol alttaki istatistik simgesinden görülebilir.

## Klavye kısayolları

| Tuş | İşlev |
|---|---|
| `Space` | Oynat / duraklat (duraklatınca bağlam görünümü) |
| `↑` / `↓` | Hızı 25 WPM artır / azalt |
| `Shift` + `↑` / `↓` | Hızı 100 WPM artır / azalt |
| `←` / `→` | Önceki / sonraki grup |
| `Shift` + `←` | **1 cümle geri** (cümle ortasındaysanız o cümlenin başına, başındaysanız bir önceki cümleye) |
| `Shift` + `→` | 1 cümle ileri |
| `1` / `2` / `3` / `4` | Grup boyutu: 1, 2, 3 kelime / öbek modu |
| `F` | Tam ekran odak modu (üst çubuk gizlenir, yazı büyür; `Esc` ile çıkış) |
| `C` | Duraklatınca bağlam görünümünü aç / kapat |
| `Ctrl` + `F` | Belgede ara (Türkçe İ/ı ve aksan duyarsız) |
| `Ctrl` + `O` | Dosya içe aktar |
| `Ctrl` + `Shift` + `V` | Metin yapıştır |
| `Esc` | Pencereyi kapat / tam ekrandan çık |
| `Delete` | Kütüphanede odaktaki belgeyi sil |

Bir metin alanına yazarken okuyucu kısayolları devre dışı kalır. Okuma alanına tıklamak da oynatır veya duraklatır.

## Gizlilik

- Uygulama yalnızca kendi kaynağından (`127.0.0.1`) dosya yükler. Belge içeriği, ayarlar ve istatistikler hiçbir dış sunucuya gönderilmez.
- Rapid Reader'daki URL'den makale içe aktarma özelliği ve ona ait sunucu kaldırılmıştır.
- Verileriniz bu tarayıcı profiline aittir. Başka tarayıcıya taşımak için Ayarlar → Kütüphane → **Yedeği dışa aktar** kullanın. Tarayıcı verilerini temizlemeden önce yedek almanız önerilir.

## Proje yapısı

```
src/core/turkish.ts    Türkçe kurallar: kısaltmalar, sıra sayıları, cümle sonu, bağlaç/edat listeleri, İ/ı katlama
src/core/text.ts       Normalleştirme, bölme (konum bilgili), bölümlere ayırma, ORP, arama
src/core/chunker.ts    1/2/3 kelime ve öbek modu, cümle başı/sonu bulma
src/core/timing.ts     Kademeli hızlanma, ayarlanabilir ek süreler, kalan süre birimleri
src/core/session.ts    Kaymasız (deadline tabanlı) oynatma oturumu, cümle gezinme, oturum WPM
src/core/storage.ts    IndexedDB kütüphane, ilerleme, istatistik, yedek
src/import/pdf*.ts     PDF metin çıkarma ve temizlik (üstbilgi, altbilgi, sayfa no, dipnot, paragraf akışı)
src/import/markdown.ts Markdown işaretlerini ayıklama
src/components/        React arayüzü (Reader, Options, Settings, Sidebar, Statistics, ImportDialog)
tests/                 Vitest testleri ve örnek dosya testleri
```

## Lisans

MIT. Bkz. `LICENSE` ve `THIRD_PARTY.md`.
