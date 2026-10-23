import { useRef, useState } from "react";
import { Upload, Clipboard, FileText } from "lucide-react";
import { Modal } from "./primitives";
import { supportedFiles } from "../import";
import { countWords } from "../core/text";

export type ImportTab = "files" | "text";
export function ImportDialog({
  onClose,
  onFiles,
  onText,
  busy,
  status,
  error,
  initialTab = "files",
}: {
  onClose: () => void;
  onFiles: (files: File[]) => void;
  onText: (text: string, title?: string) => void;
  busy: boolean;
  status: string;
  error?: string;
  initialTab?: ImportTab;
}) {
  const [tab, setTab] = useState(initialTab);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [clipboardError, setClipboardError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const tabs = [
    { value: "files", label: "Dosyalar", icon: Upload },
    { value: "text", label: "Metin yapıştır", icon: Clipboard },
  ] as const;
  async function clipboard() {
    try {
      setText(await navigator.clipboard.readText());
      setClipboardError("");
    } catch {
      setClipboardError(
        "Metni klavyeyle (Ctrl+V) veya tarayıcı menüsüyle aşağıya yapıştırın.",
      );
    }
  }
  return (
    <Modal
      title="Kütüphaneye ekle"
      onClose={onClose}
      className="import-modal"
      footer={
        <>
          <span className="fine-print">
            Dosyalar ve yapıştırılan metin bu cihazdan çıkmaz.
          </span>
          <button type="button" className="button" onClick={onClose}>
            {busy ? "Kapat" : "Vazgeç"}
          </button>
          {tab === "text" && (
            <button
              type="button"
              className="button primary"
              disabled={busy || !text.trim()}
              onClick={() => onText(text, title)}
            >
              {busy ? "Ekleniyor..." : "Kütüphaneye ekle"}
            </button>
          )}
        </>
      }
    >
      <div
        className="import-tabs"
        role="tablist"
        aria-label="İçe aktarma kaynağı"
      >
        {tabs.map((t) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            key={t.value}
            disabled={busy}
            onClick={() => setTab(t.value)}
          >
            <t.icon size={17} />
            {t.label}
          </button>
        ))}
      </div>
      <div
        className="import-panel"
        role="tabpanel"
        aria-label={tabs.find((t) => t.value === tab)!.label}
      >
        {tab === "files" && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept={supportedFiles}
              hidden
              onChange={(e) => {
                if (e.target.files?.length) onFiles([...e.target.files]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className={`drop-zone ${dragging ? "dragging" : ""}`}
              disabled={busy}
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragging(false);
                if (!busy && e.dataTransfer.files.length)
                  onFiles([...e.dataTransfer.files]);
              }}
            >
              <span className="drop-icon">
                <Upload size={26} strokeWidth={1.4} />
              </span>
              <strong>
                {busy ? "Belgeler ekleniyor" : "Belgelerinizi buraya bırakın"}
              </strong>
              <span>veya dosya seçin</span>
              <span className="file-types">
                PDF, EPUB, Markdown, TXT, DOCX, RTF, HTML
              </span>
            </button>
            <p className="fine-print import-file-note">
              <FileText size={14} />
              Dosya başına en fazla 100 MB. PDF'lerde metin seçilebilir olmalı
              (taranmış PDF'ler okunamaz).
            </p>
          </>
        )}
        {tab === "text" && (
          <>
            <div className="paste-title">
              <label className="field-label" htmlFor="paste-title">
                Başlık <span>İsteğe bağlı</span>
              </label>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={clipboard}
              >
                <Clipboard size={14} />
                Panodan oku
              </button>
            </div>
            <input
              id="paste-title"
              className="text-field"
              placeholder="Boş bırakılırsa ilk satır kullanılır"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
            <label className="field-label" htmlFor="paste-text">
              Metin
            </label>
            <textarea
              id="paste-text"
              placeholder="Okumak istediğiniz metni yapıştırın..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <span className="fine-print">
              {clipboardError ||
                `${countWords(text).toLocaleString("tr")} kelime`}
            </span>
          </>
        )}
      </div>
      {busy && (
        <p className="import-status" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
