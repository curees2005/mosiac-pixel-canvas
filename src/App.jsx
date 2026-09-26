import Canvas from "./components/Canvas.jsx";
import "./App.css";

export default function App() {
  return (
    <div className="shell">
      <header className="shell-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-name">Mosaic</div>
            <div className="brand-tag">a canvas everyone is drawing on, one pixel at a time</div>
          </div>
        </div>
      </header>
      <main className="shell-main">
        <Canvas />
      </main>
      <footer className="shell-footer">
        Shared, public, permanent — refresh anytime to see what changed.
      </footer>
    </div>
  );
}
