import { Sun, Moon, Monitor, BookOpen } from "lucide-react";
import {
  MAX_WPM,
  MIN_WPM,
  type ChunkMode,
  type Preferences,
  type Theme,
} from "../core/types";
import { Stepper, Toggle } from "./primitives";

const themes = [
  { value: "dark", label: "Koyu", icon: Moon },
  { value: "light", label: "Açık", icon: Sun },
  { value: "sepia", label: "Sepya", icon: BookOpen },
  { value: "system", label: "Sistem", icon: Monitor },
] as const;

export function chunkLabel(mode: ChunkMode) {
  return mode === "phrase" ? "Öbek modu" : `${mode} kelime`;
}

export function ThemeSelector({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
}) {
  return (
    <div className="theme-selector" role="group" aria-label="Tema">
      {themes.map((t) => (
        <button
          key={t.value}
          type="button"
          aria-pressed={theme === t.value}
          onClick={() => onChange(t.value)}
        >
          <t.icon size={17} />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  off,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  off?: string;
}) {
  return (
    <label className="range-label">
      <span>
        {label} <output>{value === 0 && off ? off : `${value} ${unit}`}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Options({
  value: p,
  onChange,
  theme,
  onTheme,
  defaults = false,
}: {
  value: Preferences;
  onChange: (p: Partial<Preferences>) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  defaults?: boolean;
}) {
  return (
    <div className="options">
      <section className="option-section">
        <h3>Görünüm</h3>
        <ThemeSelector theme={theme} onChange={onTheme} />
        <Slider
          label="Yazı boyutu"
          value={Math.round(p.fontSize)}
          min={42}
          max={140}
          step={2}
          unit="px"
          onChange={(fontSize) => onChange({ fontSize })}
        />
        <div className="option-row">
          <span>Grup boyutu</span>
          <div
            className="segmented compact"
            role="group"
            aria-label="Grup boyutu"
          >
            {([1, 2, 3, "phrase"] as ChunkMode[]).map((n) => (
              <button
                type="button"
                key={String(n)}
                aria-pressed={p.chunkMode === n}
                onClick={() => onChange({ chunkMode: n })}
              >
                {n === "phrase" ? "Öbek" : n}
              </button>
            ))}
          </div>
        </div>
        <p className="fine-print">
          Öbek modu en fazla 3 kelimeyi noktalama, bağlaç (ve, ama, çünkü...) ve
          edatlara (için, gibi, göre...) göre anlamlı gruplar; 13 harf ve üzeri
          kelimeleri tek başına gösterir.
        </p>
      </section>
      <section className="option-section">
        <h3>Hız</h3>
        <Slider
          label={defaults ? "Varsayılan hız" : "Hedef hız"}
          value={p.wordsPerMinute}
          min={MIN_WPM}
          max={MAX_WPM}
          step={25}
          unit="WPM"
          onChange={(wordsPerMinute) => onChange({ wordsPerMinute })}
        />
        <Slider
          label="Kademeli hızlanma süresi"
          value={p.rampSeconds}
          min={0}
          max={120}
          step={5}
          unit="sn"
          off="Kapalı"
          onChange={(rampSeconds) => onChange({ rampSeconds })}
        />
        <Slider
          label="Başlangıç hızı"
          value={p.rampStartWpm}
          min={MIN_WPM}
          max={MAX_WPM}
          step={25}
          unit="WPM"
          onChange={(rampStartWpm) => onChange({ rampStartWpm })}
        />
        <p className="fine-print">
          Her başlatışta hız, başlangıç hızından hedef hıza belirlenen sürede
          doğrusal olarak çıkar. Başlangıç hızı hedeften yüksekse hızlanma
          uygulanmaz.
        </p>
      </section>
      <section className="option-section">
        <h3>Ek süreler</h3>
        <Slider
          label="Cümle sonu (. ! ?)"
          value={p.sentencePause}
          min={0}
          max={400}
          step={10}
          unit="%"
          off="Kapalı"
          onChange={(sentencePause) => onChange({ sentencePause })}
        />
        <Slider
          label="Virgül, noktalı virgül, iki nokta"
          value={p.commaPause}
          min={0}
          max={300}
          step={10}
          unit="%"
          off="Kapalı"
          onChange={(commaPause) => onChange({ commaPause })}
        />
        <Slider
          label="Paragraf sonu"
          value={p.paragraphPause}
          min={0}
          max={600}
          step={10}
          unit="%"
          off="Kapalı"
          onChange={(paragraphPause) => onChange({ paragraphPause })}
        />
        <Slider
          label="Uzun kelime (16+ harfte tam değer)"
          value={p.longWordPause}
          min={0}
          max={200}
          step={10}
          unit="%"
          off="Kapalı"
          onChange={(longWordPause) => onChange({ longWordPause })}
        />
        <p className="fine-print">
          Yüzdeler bir kelimenin gösterim süresine göredir: %100, o noktada bir
          kelimelik ek bekleme demektir. Kısaltmalar (bkz., s., md., Prof.) ve
          sıra sayıları ("7. madde") cümle sonu sayılmaz.
        </p>
      </section>
      <section className="option-section">
        <h3>Bağlam</h3>
        <Toggle
          label="Duraklatınca tam metni göster"
          checked={p.contextOnPause}
          onChange={(contextOnPause) => onChange({ contextOnPause })}
        />
        <Toggle
          label="Odak kelimenin çevresini göster"
          checked={p.showContext}
          onChange={(showContext) => onChange({ showContext })}
        />
        <Toggle
          label="Okurken çevreyi gizle"
          checked={p.focusMode}
          disabled={!p.showContext}
          onChange={(focusMode) => onChange({ focusMode })}
        />
        <Stepper
          label="Devam ederken geri sar"
          value={p.resumeRewindWords}
          min={0}
          max={20}
          suffix="kelime"
          onChange={(resumeRewindWords) => onChange({ resumeRewindWords })}
        />
      </section>
    </div>
  );
}
