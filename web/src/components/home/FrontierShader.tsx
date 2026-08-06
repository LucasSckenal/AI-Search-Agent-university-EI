"use client";

import { useEffect, useRef } from "react";

const VERTEX_SRC = `attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Paints an expanding "search frontier" - a ring wave pulsing outward from center, with glowing
// grid nodes and connecting lines lighting up only inside the ring as it passes. It's a literal,
// ambient visualization of what the whole app does (a search frontier expanding through a state
// space), not a generic decorative blob.
const FRAGMENT_SRC = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 v_uv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = v_uv;
  vec2 auv = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  vec3 bg = vec3(0.067, 0.075, 0.102);
  vec3 blue = vec3(0.686, 0.776, 1.0);
  vec3 purple = vec3(0.808, 0.741, 1.0);

  float dist = length(auv);
  float wave = sin(dist * 13.0 - u_time * 1.7) * 0.5 + 0.5;
  wave *= exp(-dist * 1.7);
  float wave2 = sin(dist * 13.0 - u_time * 1.7 - 2.4) * 0.5 + 0.5;
  wave2 *= exp(-dist * 1.7) * 0.6;

  vec2 guv = auv * 22.0;
  vec2 ipos = floor(guv), fpos = fract(guv);
  float n = hash(ipos);
  float edge = fract(u_time * 0.22);
  // Width of the "ring" the grid-line effect is confined to - was 0.26 (a band ~0.5 wide, nearly
  // half the visible dist range), which made the grid lines show almost everywhere at once
  // instead of sweeping past as a thin traveling ring.
  float activity = smoothstep(edge - 0.06, edge, dist) * smoothstep(edge + 0.06, edge, dist);

  float node = 0.0;
  if (n > 0.84) {
    float glow = exp(-length(fpos - 0.5) * 9.0);
    node = glow * (0.5 + 0.5 * sin(u_time * 1.4 + n * 10.0));
  }

  float lines = smoothstep(0.025, 0.0, abs(fpos.x - 0.5)) * smoothstep(0.35, 0.5, n);
  lines += smoothstep(0.025, 0.0, abs(fpos.y - 0.5)) * smoothstep(0.35, 0.5, n);
  lines *= 0.28 * activity;

  float core = exp(-dist * 2.6) * (0.65 + 0.35 * sin(u_time * 1.15));

  vec3 col = bg;
  col += blue * wave * 0.22;
  col += purple * wave2 * 0.16;
  vec3 nodeColor = mix(blue, purple, n);
  col += nodeColor * node * 0.75 * (1.0 - dist * 0.7);
  col += nodeColor * lines * 0.4;
  col += mix(blue, purple, 0.5) * core * 0.55;
  col *= 1.0 - dist * 0.65;

  gl_FragColor = vec4(col, 1.0);
}`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

/**
 * Hero backdrop: a small self-contained WebGL canvas (no react-three-fiber needed for a single
 * full-screen fragment shader). Skips setup entirely under prefers-reduced-motion, and tears down
 * its rAF loop and GL resources on unmount so navigating away from the home page doesn't leak a
 * running render loop.
 */
export function FrontierShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const glContext = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!glContext || !(glContext instanceof WebGLRenderingContext)) return;
    // Re-bound as its own const so the WebGLRenderingContext narrowing above is visible inside
    // the render() closure below too - TS doesn't otherwise carry instanceof-narrowing on a
    // captured outer variable into a nested function declaration.
    const gl: WebGLRenderingContext = glContext;

    function syncSize() {
      const w = canvas!.clientWidth || 1280;
      const h = canvas!.clientHeight || 640;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
    }
    syncSize();
    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(canvas);

    const program = gl.createProgram();
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    if (!program || !vertexShader || !fragmentShader) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRes = gl.getUniformLocation(program, "u_resolution");

    let rafId = 0;
    function render(t: number) {
      gl.viewport(0, 0, canvas!.width, canvas!.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas!.width, canvas!.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
