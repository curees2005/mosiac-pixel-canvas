import { useEffect, useRef, useState, useCallback } from "react";
import { GRID_COLS, GRID_ROWS, COOLDOWN_SECONDS, PALETTE } from "../constants.js";
import { getClientId } from "../clientId.js";

const CELL_SIZE = 14;
const POLL_MS = 3000;

export default function Canvas() {
  const canvasRef = useRef(null);
  const pixelsRef = useRef(new Array(GRID_COLS * GRID_ROWS).fill(0));
  const [selectedColor, setSelectedColor] = useState(15); // lime by default
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pixelCount, setPixelCount] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pixels = pixelsRef.current;
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const idx = y * GRID_COLS + x;
        ctx.fillStyle = PALETTE[pixels[idx]] || PALETTE[0];
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/canvas-state");
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      pixelsRef.current = data.pixels;
      setPixelCount(data.pixels.filter((p) => p !== 0).length);
      draw();
      setError("");
    } catch {
      setError("Can't reach the canvas — check MONGODB_URI is set.");
    } finally {
      setLoaded(true);
    }
  }, [draw]);

  useEffect(() => {
    fetchState();
    const poll = setInterval(fetchState, POLL_MS);
    return () => clearInterval(poll);
  }, [fetchState]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    draw();
  }, [draw, loaded]);

  const cooldownRemaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const onCooldown = cooldownRemaining > 0;

  async function handleClick(e) {
    if (onCooldown) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return;

    // Optimistic paint so it feels instant, then confirm with the server.
    const idx = y * GRID_COLS + x;
    const prev = pixelsRef.current[idx];
    pixelsRef.current[idx] = selectedColor;
    draw();

    try {
      const res = await fetch("/api/place-pixel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y, colorIndex: selectedColor, clientId: getClientId() }),
      });
      if (res.status === 429) {
        const data = await res.json();
        pixelsRef.current[idx] = prev;
        draw();
        setCooldownUntil(Date.now() + (data.retryAfterMs || COOLDOWN_SECONDS * 1000));
        setError(`Someone's fast — wait ${Math.ceil((data.retryAfterMs || 0) / 1000)}s before your next pixel.`);
        return;
      }
      if (!res.ok) throw new Error("place failed");
      setError("");
      setCooldownUntil(Date.now() + COOLDOWN_SECONDS * 1000);
      setPixelCount((c) => (prev === 0 ? c + 1 : c));
    } catch {
      pixelsRef.current[idx] = prev;
      draw();
      setError("That pixel didn't save — try again.");
    }
  }

  return (
    <div className="canvas-card">
      <div className="canvas-topbar">
        <span>{GRID_COLS}×{GRID_ROWS} grid · {pixelCount} pixels placed</span>
        <span className={`status-pill`}>
          <span className={`status-dot ${onCooldown ? "dot-cooldown" : "dot-ready"}`} />
          {onCooldown ? `next pixel in ${cooldownRemaining}s` : "ready to place"}
        </span>
      </div>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          className="mosaic-canvas"
          width={GRID_COLS * CELL_SIZE}
          height={GRID_ROWS * CELL_SIZE}
          onClick={handleClick}
          role="img"
          aria-label="Shared pixel canvas"
        />
      </div>

      <div className="palette-row">
        {PALETTE.map((color, i) => (
          <button
            key={i}
            className={`swatch ${selectedColor === i ? "swatch-active" : ""}`}
            style={{ background: color }}
            onClick={() => setSelectedColor(i)}
            aria-label={`Select color ${i}`}
            aria-pressed={selectedColor === i}
          />
        ))}
      </div>

      <p className="hint-line">
        Pick a color, click a cell. Everyone shares this canvas — you get <strong>one pixel every {COOLDOWN_SECONDS}s</strong>.
      </p>

      {error && <p className="error-line">{error}</p>}
    </div>
  );
}
