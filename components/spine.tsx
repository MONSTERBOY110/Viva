"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DayMark } from "@/lib/journey";
import { Ledger } from "@/components/ledger";

/**
 * The Spine: the Ledger wrapped into space. Same notation as the 2D strip
 * (a stroke per attempt, hollow for skipped, brass rule for never passed),
 * curved across 31 days and re-inked as you move between candidates.
 *
 * Deliberately not a particle field: flat unlit materials, structured layout,
 * and every mark is a data point. Falls back to the full 2D Ledger when WebGL
 * is unavailable, and stops rotating under prefers-reduced-motion.
 */

const MAX_STROKES = 5;
const RADIUS = 2.5;
const ARC = 0.9; // radians the 31 days span, ends curl toward the viewer
const STROKE_W = 0.056;
const STROKE_H = 0.032;
const STROKE_GAP = 0.088;
const COLUMN_GUIDE_H = 0.5;

const COLORS = {
  quill: new THREE.Color("#3fa96b"),
  quillBright: new THREE.Color("#7fe6a6"),
  lamp: new THREE.Color("#e5b45c"),
  lampDim: new THREE.Color("#8a6a34"),
  faint: new THREE.Color("#5c5a55"),
  rule: new THREE.Color("#3a3a3a"),
};

function strokeColor(mark: DayMark): THREE.Color {
  if (mark.kind === "first-try") return COLORS.quill;
  if (mark.kind === "struggled") {
    return mark.attempts >= 3 ? COLORS.lamp : COLORS.quill;
  }
  if (mark.kind === "failed") return COLORS.lampDim;
  return COLORS.faint;
}

function dayPosition(i: number, total: number) {
  const t = total <= 1 ? 0.5 : i / (total - 1);
  const angle = (t - 0.5) * ARC;
  return {
    x: Math.sin(angle) * RADIUS,
    z: RADIUS - Math.cos(angle) * RADIUS,
    ry: -angle,
  };
}

function DayColumn({
  mark,
  index,
  total,
  reduceMotion,
  hovered,
  onHover,
}: {
  mark: DayMark;
  index: number;
  total: number;
  reduceMotion: boolean;
  hovered: boolean;
  onHover: (mark: DayMark | null) => void;
}) {
  const { x, z, ry } = useMemo(() => dayPosition(index, total), [index, total]);
  const strokeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const color = useMemo(() => strokeColor(mark), [mark]);
  const shown =
    mark.kind === "first-try" ||
    mark.kind === "struggled" ||
    mark.kind === "failed"
      ? Math.min(mark.attempts, MAX_STROKES)
      : 0;

  // Strokes grow toward their target instead of popping, so moving between
  // candidates reads as the page being re-inked.
  useFrame((_, delta) => {
    const k = reduceMotion ? 1 : 1 - Math.pow(0.001, delta);
    strokeRefs.current.forEach((mesh, s) => {
      if (!mesh) return;
      const target = s < shown ? 1 : 0;
      mesh.scale.x = reduceMotion
        ? target
        : THREE.MathUtils.lerp(mesh.scale.x, target, k);
      mesh.visible = mesh.scale.x > 0.02;
    });
  });

  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      {/* Hit target, generous and invisible. */}
      <mesh
        position={[0, 0.2, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(mark);
        }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={[0.082, 0.9, 0.16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Ruled column, so the structure stays legible on sparse days. */}
      <mesh position={[0, COLUMN_GUIDE_H / 2, 0]}>
        <boxGeometry args={[0.004, COLUMN_GUIDE_H, 0.004]} />
        <meshBasicMaterial
          color={hovered ? COLORS.quill : COLORS.rule}
          transparent
          opacity={hovered ? 0.5 : 0.24}
        />
      </mesh>

      {/* The ruled baseline this day sits on. */}
      <mesh position={[0, -0.014, 0]}>
        <boxGeometry args={[0.082, 0.007, 0.04]} />
        <meshBasicMaterial color={COLORS.rule} />
      </mesh>

      {Array.from({ length: MAX_STROKES }, (_, s) => (
        <mesh
          key={s}
          ref={(el) => {
            strokeRefs.current[s] = el;
          }}
          position={[0, s * STROKE_GAP + STROKE_H, 0]}
          scale={[0, 1, 1]}
        >
          <boxGeometry args={[STROKE_W, STROKE_H, 0.09]} />
          <meshBasicMaterial color={hovered ? COLORS.quillBright : color} />
        </mesh>
      ))}

      {mark.kind === "skipped" && (
        <lineSegments position={[0, 0.05, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(STROKE_W, 0.07, 0.08)]} />
          <lineBasicMaterial color={COLORS.faint} />
        </lineSegments>
      )}

      {mark.kind === "untouched" && (
        <mesh position={[0, 0.018, 0]}>
          <boxGeometry args={[0.02, 0.02, 0.02]} />
          <meshBasicMaterial color={COLORS.faint} transparent opacity={0.55} />
        </mesh>
      )}

      {mark.kind === "failed" && (
        <mesh position={[0, -0.085, 0]}>
          <boxGeometry args={[STROKE_W, STROKE_H, 0.09]} />
          <meshBasicMaterial color={COLORS.lamp} />
        </mesh>
      )}
    </group>
  );
}

function Assembly({
  marks,
  reduceMotion,
  hoveredDay,
  onHover,
}: {
  marks: DayMark[];
  reduceMotion: boolean;
  hoveredDay: number | null;
  onHover: (mark: DayMark | null) => void;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    if (reduceMotion) {
      group.current.rotation.y = -0.07;
      return;
    }
    // A slow sweep, well under the 0.2 Hz oscillation threshold.
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.1;
  });

  return (
    <group ref={group} position={[0, -0.03, 0]} rotation={[0.06, 0, 0]}>
      {marks.map((mark, i) => (
        <DayColumn
          key={mark.day}
          mark={mark}
          index={i}
          total={marks.length}
          reduceMotion={reduceMotion}
          hovered={hoveredDay === mark.day}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl")),
    );
  } catch {
    return false;
  }
}

export function Spine({
  marks,
  onHoverDay,
}: {
  marks: DayMark[];
  onHoverDay: (mark: DayMark | null) => void;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const handleHover = (mark: DayMark | null) => {
    setHoveredDay(mark?.day ?? null);
    onHoverDay(mark);
  };

  useEffect(() => {
    setSupported(webglAvailable());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (supported === null) {
    return <div className="h-full" aria-hidden />;
  }

  if (!supported) {
    return (
      <div className="flex h-full items-center px-4">
        <Ledger marks={marks} variant="full" onHoverDay={onHoverDay} />
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 0.36, 2.9], fov: 46 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => handleHover(null)}
      style={{ touchAction: "pan-y" }}
    >
      <Assembly
        marks={marks}
        reduceMotion={reduceMotion}
        hoveredDay={hoveredDay}
        onHover={handleHover}
      />
    </Canvas>
  );
}
