import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { loadStats } from "../core/storage";
import { formatTime, localDate, type DailyStats } from "../core/types";
import { Modal } from "./primitives";

export function Statistics({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void loadStats()
      .then(setStats)
      .catch(() => setError("Okuma istatistikleri yüklenemedi."));
  }, []);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    const date = localDate(d.getTime());
    return stats.find((s) => s.date === date) ?? { date, words: 0, seconds: 0 };
  });
  const today = days.at(-1)!;
  const week = days
    .slice(-7)
    .reduce(
      (a, s) => ({ words: a.words + s.words, seconds: a.seconds + s.seconds }),
      { words: 0, seconds: 0 },
    );
  const total = stats.reduce(
    (a, s) => ({ words: a.words + s.words, seconds: a.seconds + s.seconds }),
    { words: 0, seconds: 0 },
  );
  const max = Math.max(100, ...days.map((s) => s.words));
  return (
    <Modal
      title="Okuma istatistikleri"
      onClose={onClose}
      className="statistics-modal"
      footer={
        <>
          <span className="fine-print">
            Yalnızca aktif oynatma süresi sayılır; duraklamalar hariçtir.
          </span>
          <button type="button" className="button" onClick={onClose}>
            Tamam
          </button>
        </>
      }
    >
      <div className="stats-grid">
        <div>
          <span>Bugün</span>
          <strong>{today.words.toLocaleString("tr")}</strong>
          <small>words read</small>
        </div>
        <div>
          <span>Son 7 gün</span>
          <strong>{week.words.toLocaleString("tr")}</strong>
          <small>words read</small>
        </div>
        <div>
          <span>Gerçek ortalama hız</span>
          <strong>
            {total.seconds > 0
              ? Math.round((total.words * 60) / total.seconds)
              : 0}
          </strong>
          <small>WPM</small>
        </div>
        <div>
          <span>Okuma süresi</span>
          <strong>{formatTime(total.seconds)}</strong>
          <small>all time</small>
        </div>
      </div>
      <div className="chart-heading">
        <h3>Son 14 gün</h3>
        <span>{total.words.toLocaleString("tr")} kelime okundu (toplam)</span>
      </div>
      <div
        className="reading-chart"
        role="img"
        aria-label={`Son 14 günde okunan kelime: ${days.map((s) => `${s.date}: ${s.words}`).join(", ")}`}
      >
        <div className="chart-scale">
          <span>{max.toLocaleString("tr")}</span>
          <span>{Math.round(max / 2).toLocaleString("tr")}</span>
          <span>0</span>
        </div>
        <div className="chart-plot">
          <div className="chart-grid-lines">
            <i />
            <i />
            <i />
          </div>
          <div className="chart-bars">
            {days.map((s, i) => (
              <div className="chart-column" key={s.date}>
                <div
                  className={`chart-bar ${i === 13 ? "today" : ""}`}
                  style={{ height: `${(s.words / max) * 100}%` }}
                  title={`${new Date(`${s.date}T12:00:00`).toLocaleDateString("tr", { month: "short", day: "numeric" })}: ${s.words.toLocaleString("tr")} kelime`}
                />
                <span>
                  {[0, 3, 6, 9, 13].includes(i)
                    ? new Date(`${s.date}T12:00:00`).toLocaleDateString("tr", {
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {!total.words && (
        <p className="stats-empty">
          <BarChart3 size={17} />
          İlerlemenizi burada görmek için okumaya başlayın.
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
