import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Agentes Inteligentes de Busca — Labirinto, Cubo Mágico e Jogo da Velha";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ALGOS = ["BFS", "DFS", "UCS", "Gulosa", "A*", "Minimax"];

export default async function Image() {
  const logoData = await readFile(join(process.cwd(), "public/logo-mark.png"), "base64");
  const logoSrc = `data:image/png;base64,${logoData}`;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#0b0e15",
          overflow: "hidden",
        }}
      >
        {/* Decorative wireframe squares, standing in for the cube/labyrinth/board motifs -
            low-contrast so they never compete with the text. */}
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 70,
            width: 300,
            height: 300,
            border: "1.5px solid rgba(175,198,255,0.16)",
            borderRadius: 20,
            transform: "rotate(18deg)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 140,
            top: 190,
            width: 300,
            height: 300,
            border: "1.5px solid rgba(206,189,255,0.12)",
            borderRadius: 20,
            transform: "rotate(-14deg)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og's Satori renderer needs a plain <img>, not next/image */}
          <img src={logoSrc} width={40} height={40} style={{ borderRadius: 10 }} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 3,
              color: "#8c909f",
              textTransform: "uppercase",
            }}
          >
            Agentes de Busca
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 66,
              fontWeight: 700,
              color: "#e1e2ec",
              lineHeight: 1.08,
              letterSpacing: -2,
            }}
          >
            <span style={{ display: "flex" }}>Agentes Inteligentes</span>
            <span style={{ display: "flex", color: "#afc6ff" }}>de Busca</span>
          </div>
          <span style={{ display: "flex", fontSize: 27, color: "#c2c6d6" }}>
            Labirinto · Cubo Mágico · Jogo da Velha
          </span>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            {ALGOS.map((a) => (
              <span
                key={a}
                style={{
                  display: "flex",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#c2c6d6",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 8,
                  padding: "6px 14px",
                }}
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            height: 3,
            width: "100%",
            background: "linear-gradient(90deg, #afc6ff, #cebdff, rgba(11,14,21,0))",
            borderRadius: 2,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
