import * as React from "react";

type RobotPlaceholderProps = {
  slug: string;
  name: string;
  size?: number;
  variant?: "card" | "hero";
};

// djb2-xor string hash with a murmur3-style avalanche finalizer —
// deterministic, so the same slug always renders the same hue + silhouette.
// The finalizer matters: without it, near-identical slugs like "xarvis-d1"
// vs "xarvis-d2" hash 1 apart and get the same silhouette + hue.
function hashSlug(slug: string): number {
  let hash = 5381;
  for (let i = 0; i < slug.length; i++) {
    hash = (Math.imul(hash, 33) ^ slug.charCodeAt(i)) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

const BODY_FILL = "#262626";

type Silhouette = (eyeFill: string) => React.ReactElement;

// Six minimal robot silhouettes, each drawn centered on (0,0) in a roughly
// 110×140 box. `eyeFill` is the background tint so the eyes read as cutouts.
// 0 — classic: round head, single antenna
const classicSilhouette: Silhouette = (eyeFill) => (
    <g fill={BODY_FILL}>
      <rect x={-2.5} y={-82} width={5} height={16} rx={2.5} />
      <circle cx={0} cy={-88} r={5.5} />
      <circle cx={0} cy={-38} r={30} />
      <rect x={-32} y={-6} width={64} height={60} rx={14} />
      <rect x={-24} y={56} width={16} height={9} rx={4.5} />
      <rect x={8} y={56} width={16} height={9} rx={4.5} />
      <circle cx={-11} cy={-40} r={4} fill={eyeFill} />
      <circle cx={11} cy={-40} r={4} fill={eyeFill} />
    </g>
);

const SILHOUETTES: Silhouette[] = [
  classicSilhouette,
  // 1 — square head, two side antennas
  (eyeFill) => (
    <g fill={BODY_FILL}>
      <rect x={-36} y={-62} width={8} height={5} rx={2.5} />
      <rect x={28} y={-62} width={8} height={5} rx={2.5} />
      <circle cx={-38} cy={-59.5} r={4.5} />
      <circle cx={38} cy={-59.5} r={4.5} />
      <rect x={-28} y={-76} width={56} height={50} rx={12} />
      <rect x={-38} y={-18} width={76} height={68} rx={16} />
      <rect x={-26} y={52} width={18} height={9} rx={4.5} />
      <rect x={8} y={52} width={18} height={9} rx={4.5} />
      <circle cx={-11} cy={-52} r={4} fill={eyeFill} />
      <circle cx={11} cy={-52} r={4} fill={eyeFill} />
    </g>
  ),
  // 2 — dome head, narrow body
  (eyeFill) => (
    <g fill={BODY_FILL}>
      <rect x={-2.5} y={-90} width={5} height={12} rx={2.5} />
      <circle cx={0} cy={-93} r={4.5} />
      <ellipse cx={0} cy={-42} rx={30} ry={34} />
      <rect x={-24} y={-4} width={48} height={62} rx={12} />
      <rect x={-30} y={60} width={60} height={8} rx={4} />
      <circle cx={-10} cy={-46} r={4} fill={eyeFill} />
      <circle cx={10} cy={-46} r={4} fill={eyeFill} />
    </g>
  ),
  // 3 — monolith: head and body one piece
  (eyeFill) => (
    <g fill={BODY_FILL}>
      <rect x={-2.5} y={-80} width={5} height={14} rx={2.5} />
      <circle cx={0} cy={-84} r={5} />
      <rect x={-36} y={-66} width={72} height={124} rx={22} />
      <circle cx={-12} cy={-38} r={4.5} fill={eyeFill} />
      <circle cx={12} cy={-38} r={4.5} fill={eyeFill} />
      <rect x={-12} y={40} width={24} height={5} rx={2.5} fill={eyeFill} />
    </g>
  ),
  // 4 — round head on a base stand
  (eyeFill) => (
    <g fill={BODY_FILL}>
      <rect
        x={10}
        y={-88}
        width={5}
        height={16}
        rx={2.5}
        transform="rotate(18 12.5 -80)"
      />
      <circle cx={17} cy={-92} r={5} />
      <circle cx={0} cy={-46} r={27} />
      <rect x={-30} y={-14} width={60} height={54} rx={14} />
      <rect x={-38} y={44} width={76} height={10} rx={5} />
      <circle cx={-10} cy={-48} r={4} fill={eyeFill} />
      <circle cx={10} cy={-48} r={4} fill={eyeFill} />
    </g>
  ),
  // 5 — small head, wide friendly body, dual antennas
  (eyeFill) => (
    <g fill={BODY_FILL}>
      <rect x={-14} y={-84} width={5} height={14} rx={2.5} />
      <rect x={9} y={-84} width={5} height={14} rx={2.5} />
      <circle cx={-11.5} cy={-87} r={4.5} />
      <circle cx={11.5} cy={-87} r={4.5} />
      <rect x={-22} y={-72} width={44} height={36} rx={11} />
      <rect x={-40} y={-30} width={80} height={88} rx={20} />
      <circle cx={-9} cy={-54} r={3.5} fill={eyeFill} />
      <circle cx={9} cy={-54} r={3.5} fill={eyeFill} />
    </g>
  ),
];

export function RobotPlaceholder({
  slug,
  name,
  size,
  variant = "card",
}: RobotPlaceholderProps) {
  const hash = hashSlug(slug);
  const hue = hash % 360;
  const silhouetteIndex = Math.floor(hash / 360) % SILHOUETTES.length;

  const backgroundFill = `hsl(${hue}, 20%, 96%)`;
  const auraFill = `hsl(${hue}, 70%, 55%)`;

  const scale = variant === "hero" ? 0.82 : 0.66;
  const auraRadius = variant === "hero" ? 74 : 62;

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={`Placeholder illustration for ${name}`}
      {...(size !== undefined
        ? { width: size, height: size }
        : { className: "h-auto w-full" })}
    >
      <rect x={0} y={0} width={200} height={200} rx={24} fill={backgroundFill} />
      <circle cx={100} cy={102} r={auraRadius} fill={auraFill} opacity={0.1} />
      <g transform={`translate(100 106) scale(${scale})`}>
        {(SILHOUETTES[silhouetteIndex] ?? classicSilhouette)(backgroundFill)}
      </g>
    </svg>
  );
}
