import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="startup-error">
        <img src="./icon.png" alt="" />
        <h1>Okuyucu açılamadı.</h1>
        <p>Kayıtlı kütüphaneniz silinmedi.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Odak Okuyucuyu yeniden yükle
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
