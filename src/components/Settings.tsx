import { useEffect, useRef, useState } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  Keyboard,
  ExternalLink,
  FolderSync,
} from "lucide-react";
import { folderSupported } from "../core/folder";
import type { FolderStatus } from "../App";
import {
  clampPreferences,
  localDate,
  type Settings as SettingsValue,
} from "../core/types";
import { exportLibrary } from "../core/storage";
import { Modal, Toggle, downloadJSON } from "./primitives";
import { Options } from "./Options";

export function Settings({
  value,
  onChange,
  onClose,
  onRestore,
  onError,
  folder,
  onConnectFolder,
  onDisconnectFolder,
  onSaveFolder,
  initialTab = "reading",
}: {
  value: SettingsValue;
  onChange: (s: SettingsValue) => void;
  onClose: () => void;
  onRestore: (file: File) => Promise<void>;
  onError: (error: unknown) => void;
  folder?: FolderStatus;
  onConnectFolder: (choose: boolean) => void;
  onDisconnectFolder: () => void;
  onSaveFolder: () => void;
  initialTab?: "reading" | "library" | "shortcuts";
}) {
  const [tab, setTab] = useState<"reading" | "library" | "shortcuts">(
    initialTab,
  );
  const [usage, setUsage] = useState<StorageEstimate>();
  const [persistent, setPersistent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then(setUsage)
      .catch(() => {});
    void navigator.storage
      ?.persisted?.()
      .then(setPersistent)
      .catch(() => {});
  }, []);
  async function backup() {
    setBusy(true);
    try {
      downloadJSON(
        await exportLibrary(),
        `odak-okuyucu-yedek-${localDate()}.json`,
      );
      setStorageMessage(
        "Yedek dışa aktarıldı. Bu dosyayı güvenli bir yerde saklayın.",
      );
    } catch (e) {
      onError(e);
      setStorageMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const shortcuts = [
    ["Space", "Oynat / duraklat (duraklatınca bağlam görünümü)"],
    ["↑ / ↓", "Hızı 25 WPM artır / azalt"],
    ["Shift + ↑ / ↓", "Hızı 100 WPM artır / azalt"],
    ["← / →", "Önceki / sonraki grup"],
    ["Shift + ← / →", "1 cümle geri / ileri"],
    ["1 / 2 / 3 / 4", "Grup boyutu: 1, 2, 3 kelime / öbek modu"],
    ["F", "Tam ekran odak modu"],
    ["C", "Duraklatınca bağlam görünümünü aç / kapat"],
    ["Ctrl + F", "Belgede ara"],
    ["Ctrl + O", "Dosya içe aktar"],
    ["Ctrl + Shift + V", "Metin yapıştır"],
    ["Esc", "Pencereyi kapat / tam ekrandan çık"],
    ["Delete", "Odaktaki kütüphane belgesini sil"],
  ] as const;
  return (
    <Modal
      title="Ayarlar"
      onClose={onClose}
      className="settings-modal"
      footer={
        <button type="button" className="button" onClick={onClose}>
          Tamam
        </button>
      }
    >
      <div className="settings-tabs" role="tablist" aria-label="Ayar bölümü">
        {(["reading", "library", "shortcuts"] as const).map((t) => (
          <button
            type="button"
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t === "reading"
              ? "Okuma varsayılanları"
              : t === "library"
                ? "Kütüphane"
                : "Kısayollar"}
          </button>
        ))}
      </div>
      {tab === "reading" && (
        <div role="tabpanel" aria-label="Okuma varsayılanları">
          <p className="settings-description">
            Varsayılanlar yeni eklenen belgelere uygulanır. Her belge kendi
            okuma seçeneklerini ayrıca saklar.
          </p>
          <Options
            value={value.defaults}
            onChange={(p) =>
              onChange({
                ...value,
                defaults: clampPreferences({ ...value.defaults, ...p }),
              })
            }
            theme={value.theme}
            onTheme={(theme) => onChange({ ...value, theme })}
            defaults
          />
          <section className="option-section">
            <h3>İçe aktarma</h3>
            <Toggle
              label="PDF'lerde dipnotları ayıkla"
              checked={value.stripFootnotes}
              onChange={(stripFootnotes) =>
                onChange({ ...value, stripFootnotes })
              }
            />
            <p className="fine-print">
              Üst simge dipnot numaraları ve sayfa altındaki küçük puntolu
              dipnot blokları çıkarılır. Üstbilgi, altbilgi ve sayfa numaraları
              her zaman ayıklanır. Ayar yalnızca yeni içe aktarılan PDF'leri
              etkiler.
            </p>
          </section>
        </div>
      )}
      {tab === "library" && (
        <div
          className="library-settings"
          role="tabpanel"
          aria-label="Kütüphane"
        >
          <section>
            <h3>Kalıcı kayıt klasörü</h3>
            <p>
              Kütüphanenizi ve okuma konumunuzu seçtiğiniz bir klasöre de
              otomatik kaydeder. Tarayıcı verileri silinse bile (örneğin
              Chrome'un "kapatınca site verilerini sil" ayarı) klasörü yeniden
              seçmeniz her şeyi geri getirir. Google Drive veya OneDrive klasörü
              seçerseniz başka bilgisayarda da kaldığınız yerden devam
              edersiniz. Uygulama internete veri göndermez; yalnızca bu klasöre
              iki dosya yazar.
            </p>
            {!folderSupported() ? (
              <p className="fine-print">
                Bu tarayıcı klasöre kaydetmeyi desteklemiyor (masaüstü Chrome
                veya Edge gerekir). Aşağıdaki yedek dosyasını kullanın.
              </p>
            ) : (
              <>
                <div className="storage-protection">
                  <FolderSync size={19} />
                  <span>
                    {!folder
                      ? "Klasör bağlı değil"
                      : folder.state === "locked"
                        ? `"${folder.name}" için izin bekleniyor`
                        : `Bağlı: "${folder.name}"${
                            folder.savedAt
                              ? ` · son kayıt ${new Date(folder.savedAt).toLocaleTimeString("tr")}`
                              : ""
                          }`}
                  </span>
                  {folder?.state === "locked" ? (
                    <button
                      type="button"
                      className="button"
                      onClick={() => onConnectFolder(false)}
                    >
                      Bağlan
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button"
                      onClick={() => onConnectFolder(true)}
                    >
                      {folder ? "Klasörü değiştir" : "Klasör seç"}
                    </button>
                  )}
                </div>
                {folder && (
                  <div className="backup-buttons">
                    {folder.state === "connected" && (
                      <button
                        type="button"
                        className="button"
                        onClick={onSaveFolder}
                      >
                        Şimdi kaydet
                      </button>
                    )}
                    <button
                      type="button"
                      className="button"
                      onClick={onDisconnectFolder}
                    >
                      Bağlantıyı kes
                    </button>
                  </div>
                )}
                {folder?.error && (
                  <p className="inline-error" role="alert">
                    {folder.error}
                  </p>
                )}
                <p className="fine-print">
                  Chrome izin sorduğunda "Her ziyarette izin ver" seçeneğini
                  işaretlerseniz klasör her açılışta kendiliğinden bağlanır.
                </p>
              </>
            )}
          </section>
          <section>
            <h3>Bu cihazda saklanır</h3>
            <p>
              Belgeleriniz, ilerlemeniz, notlarınız ve istatistikleriniz bu
              tarayıcıda (IndexedDB) durur. Dosyalar ve yapıştırılan metin
              hiçbir sunucuya gönderilmez; uygulamada analitik veya telemetri
              yoktur.
            </p>
            {usage && (
              <span className="storage-size">
                {((usage.usage ?? 0) / 1024 / 1024).toFixed(1)} MB kullanılıyor
                {usage.quota
                  ? ` (kullanılabilir: ${(usage.quota / 1024 / 1024 / 1024).toFixed(1)} GB)`
                  : ""}
              </span>
            )}
            <div className="storage-protection">
              <ShieldCheck size={19} />
              <span>
                {persistent
                  ? "Kalıcı depolama etkin"
                  : "Tarayıcı verilerini temizlemeden önce yedek alın"}
              </span>
              {!persistent && navigator.storage?.persist && (
                <button
                  type="button"
                  className="button"
                  onClick={async () => {
                    const granted = await navigator.storage.persist();
                    setPersistent(granted);
                    setStorageMessage(
                      granted
                        ? "Kütüphaneniz otomatik depolama temizliğine karşı korunuyor."
                        : "Tarayıcı kalıcı depolamaya izin vermedi. Dışa aktarılmış bir yedek saklayın.",
                    );
                  }}
                >
                  Kütüphaneyi koru
                </button>
              )}
            </div>
            {storageMessage && (
              <p className="fine-print" role="status">
                {storageMessage}
              </p>
            )}
          </section>
          <section>
            <h3>Yedekler</h3>
            <p>
              Kütüphanenizi başka bir tarayıcıya veya cihaza taşımak için dışa
              aktarın. Geri yükleme belge ekler, mevcut ilerlemeyi korur.
            </p>
            <div className="backup-buttons">
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={backup}
              >
                <Download size={16} />
                Yedeği dışa aktar
              </button>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <Upload size={16} />
                Yedeği geri yükle
              </button>
              <input
                ref={input}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setBusy(true);
                  try {
                    await onRestore(file);
                    setStorageMessage(
                      "Yedek geri yüklendi. Mevcut belgeler ve ilerleme korundu.",
                    );
                  } catch (e) {
                    setStorageMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </div>
          </section>
          <section className="about-app">
            <img src="./icon.png" alt="" />
            <div>
              <strong>Odak Okuyucu</strong>
              <span>Rapid Reader (MIT) tabanlı, açık kaynak</span>
              <a
                href="https://github.com/Zer0codestuff/Rapid-Reader"
                target="_blank"
                rel="noreferrer"
              >
                Özgün proje
                <ExternalLink size={13} />
              </a>
            </div>
          </section>
        </div>
      )}
      {tab === "shortcuts" && (
        <div role="tabpanel" aria-label="Kısayollar">
          <p className="settings-description">
            <Keyboard size={17} />
            Bir alana yazı yazarken okuyucu kısayolları çalışmaz.
          </p>
          <dl className="shortcuts-list">
            {shortcuts.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  <kbd>{key}</kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p className="fine-print">
            Okuma alanına tıklamak oynatır veya duraklatır. Metin modunda ve
            duraklatılmış bağlam görünümünde bir kelimeye tıklamak o konuma
            gider.
          </p>
        </div>
      )}
    </Modal>
  );
}
