"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/shared/Panel";

const CANVAS_SIZE = 224; // multiple of 8 - keeps grid block-averaging boundaries pixel-clean

/**
 * Freehand drawing surface that continuously downsamples itself into a `gridSize`x`gridSize` grid
 * of [0, 1] ink-coverage values (block-averaged brightness) - what the network actually sees, fed
 * back live on every pointer move, not just on release, so the prediction updates as you draw.
 */
export function DrawCanvas({
  gridSize,
  onChange,
  accentColor = "var(--primary)",
}: {
  gridSize: number;
  onChange: (pixels: number[]) => void;
  accentColor?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const sample = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    const img = ctx.getImageData(0, 0, width, height).data;
    const blockW = width / gridSize;
    const blockH = height / gridSize;
    const out = new Array(gridSize * gridSize).fill(0);
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        let sum = 0;
        let count = 0;
        const x0 = Math.floor(gx * blockW);
        const x1 = Math.floor((gx + 1) * blockW);
        const y0 = Math.floor(gy * blockH);
        const y1 = Math.floor((gy + 1) * blockH);
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const idx = (y * width + x) * 4;
            sum += (img[idx] + img[idx + 1] + img[idx + 2]) / (3 * 255);
            count++;
          }
        }
        out[gy * gridSize + gx] = count > 0 ? sum / count : 0;
      }
    }
    onChange(out);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange(new Array(gridSize * gridSize).fill(0));
  };

  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear() only needs to run once, on mount
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const dot = (p: { x: number; y: number }) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawingRef.current = true;
    const p = getPos(e);
    lastPointRef.current = p;
    dot(p);
    sample();
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const p = getPos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 28;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current!.x, lastPointRef.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    sample();
  };

  const handleUp = () => {
    drawingRef.current = false;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="touch-none rounded-xl border border-white/10"
        style={{ width: 220, height: 220, cursor: "crosshair" }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
      />
      <button className="btn-pill" onClick={clear}>
        <Icon name="delete" className="text-[15px]" /> Limpar
      </button>
    </div>
  );
}
