"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DARDANI_LOOPS, type DardaniLoopName } from "@/lib/dardani-assets";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/**
 * One Dardani loop, looked up by name in lib/dardani-assets.ts.
 *
 * Transparency without trusting the video decoder. A VP9 WebM keeps its alpha
 * only when the browser's decoder honours it, and many Windows machines with
 * hardware video decode drop it — the hidden pixels then show as a white square
 * behind Dardani. So the site plays a stacked-alpha MP4 instead (colour in the
 * top half, the alpha mask as grey in the bottom half; see
 * scripts/build-dardani-assets.py) and puts the two back together in a WebGL
 * canvas. An ordinary H.264 MP4 decodes the same everywhere, Safari included.
 *
 * The server renders only the loop's first frame, a transparent WebP still, so
 * something is on screen before any script runs and there is no hydration
 * mismatch. The canvas takes over once its first frame is drawn. With no WebGL,
 * or under prefers-reduced-motion, the still simply stays.
 *
 * Changing `name` hands over in two beats rather than a cut or a cross-fade:
 * the current Dardani dips out (170ms), then the new one hops in with a little
 * overshoot. One Dardani on screen at a time. The loops themselves are never
 * trimmed or faded at their own loop point. Off screen, the video pauses.
 */

type Phase = "idle" | "out" | "in";

export default function DardaniLoop({
  name,
  alt,
  decorative = false,
  fit = "contain",
  className,
  style,
}: {
  name: DardaniLoopName;
  alt?: string;
  decorative?: boolean;
  fit?: "contain" | "cover";
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState<{ name: DardaniLoopName; id: number; phase: Phase }>({
    name,
    id: 0,
    phase: "idle",
  });
  /** The loop to hop in once the current one has finished dipping out. */
  const pending = useRef<DardaniLoopName>(name);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    pending.current = name;
    setShown((s) => {
      if (s.name === name) return s.phase === "out" ? { ...s, phase: "idle" } : s;
      // Reduced motion: swap in place, no travel.
      if (reduced) return { name, id: s.id + 1, phase: "idle" };
      return s.phase === "out" ? s : { ...s, phase: "out" };
    });
  }, [name, reduced]);

  const onPhaseEnd = () =>
    setShown((s) =>
      s.phase === "out"
        ? { name: pending.current, id: s.id + 1, phase: "in" }
        : s.phase === "in"
          ? { ...s, phase: "idle" }
          : s,
    );

  const loop = DARDANI_LOOPS[shown.name];
  const label = decorative ? undefined : (alt ?? loop.alt);

  return (
    <span
      className={["dardani-loop", className].filter(Boolean).join(" ")}
      style={
        {
          "--dl-ratio": `${loop.width} / ${loop.height}`,
          "--dl-fit": fit,
          ...style,
        } as CSSProperties
      }
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Layer
        key={shown.id}
        name={shown.name}
        phase={shown.phase}
        animate={mounted && !reduced}
        onPhaseEnd={onPhaseEnd}
      />
    </span>
  );
}

function Layer({
  name,
  phase,
  animate,
  onPhaseEnd,
}: {
  name: DardaniLoopName;
  phase: Phase;
  animate: boolean;
  onPhaseEnd: () => void;
}) {
  const loop = DARDANI_LOOPS[name];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // The still stays until the canvas has drawn a real frame over it.
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!animate) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    return playStacked(canvas, video, () => setLive(true));
  }, [animate]);

  return (
    <span
      className="dardani-loop-layer"
      data-phase={phase === "idle" ? undefined : phase}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && phase !== "idle") onPhaseEnd();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the poster is the loop's own first frame */}
      <img src={loop.poster} alt="" draggable={false} data-hidden={live || undefined} />
      {animate && (
        <>
          <canvas ref={canvasRef} width={loop.width} height={loop.height} data-live={live || undefined} />
          <video
            ref={videoRef}
            className="dardani-loop-source"
            src={loop.stack}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
          />
        </>
      )}
    </span>
  );
}

const VERTEX = `
attribute vec2 p;
varying vec2 uv;
void main() {
  uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

// Top half is premultiplied colour, bottom half is the alpha mask as grey.
const FRAGMENT = `
precision mediump float;
uniform sampler2D frame;
varying vec2 uv;
void main() {
  vec3 colour = texture2D(frame, vec2(uv.x, uv.y * 0.5)).rgb;
  float alpha = texture2D(frame, vec2(uv.x, 0.5 + uv.y * 0.5)).r;
  gl_FragColor = vec4(colour * step(0.02, alpha), alpha);
}`;

/**
 * Play a stacked-alpha video into a canvas. Returns a cleanup function.
 * Calls `onFirstFrame` once a real frame has been drawn; if WebGL is missing it
 * never does, and the caller's still stays on screen.
 */
function playStacked(canvas: HTMLCanvasElement, video: HTMLVideoElement, onFirstFrame: () => void) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return () => {};

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return () => {};
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const p = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(p);
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let stopped = false;
  let first = true;
  let raf = 0;

  const draw = () => {
    if (stopped || video.readyState < 2) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (first) {
      first = false;
      onFirstFrame();
    }
  };

  type FrameVideo = HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: () => void) => number;
    cancelVideoFrameCallback?: (id: number) => void;
  };
  const v = video as FrameVideo;
  let frameId = 0;
  const onFrame = () => {
    draw();
    if (!stopped) frameId = v.requestVideoFrameCallback!(onFrame);
  };
  const onTick = () => {
    draw();
    if (!stopped) raf = window.requestAnimationFrame(onTick);
  };
  if (v.requestVideoFrameCallback) frameId = v.requestVideoFrameCallback(onFrame);
  else raf = window.requestAnimationFrame(onTick);

  // iOS wants the muted attribute itself before it will autoplay.
  video.muted = true;
  video.setAttribute("muted", "");
  const play = () => void video.play().catch(() => {});
  play();

  // Only play while on screen.
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) play();
    else video.pause();
  });
  io.observe(canvas);

  return () => {
    stopped = true;
    io.disconnect();
    window.cancelAnimationFrame(raf);
    if (frameId && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(frameId);
    video.pause();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}
