import { useId } from "react";
import type { NiroExpression } from "@/lib/niro";
import { niroAssetFor } from "@/lib/niro-assets";

// 🎨 Niro, drawn once as vector art: dark navy messy anime hair with his
// signature cyan strand, electric-blue eyes, a deep-navy oversized hoodie
// with cyan drawstrings and the Niro Spark on the chest. Every expression
// reuses the SAME head, hair and hoodie — only brows, eyes, mouth, head
// tilt and a small pose detail change — so it's always recognisably him.
//
// This is v1 in-house vector art. Final commissioned illustrations can
// replace any expression without code changes: drop the file in
// /public/niro/ and register it in lib/niro-assets.ts (see
// public/niro/README.md).
//
//   crop="bust"  → head + shoulders + pose (Level 1/2 presence)
//   crop="head"  → face only, for NiroAvatar (Level 3)

const C = {
  skin: "#f7d9c4",
  skinShade: "#eabfa6",
  hair: "#121a36",
  hairHi: "#2a3566",
  cyan: "#22d3ee",
  cyanHi: "#a5f3fc",
  hoodie: "#1f2b6b",
  hoodieDark: "#172052",
  hoodieLight: "#34449a",
  lash: "#121a36",
  pupil: "#0b1330",
  mouth: "#7c3b40",
  tongue: "#ef8f8f",
  blush: "#f7a1a1",
  lime: "#bef264",
};

type EyeKind = "open" | "narrow" | "wide" | "happy" | "sleepy";

const LOOK: Record<
  NiroExpression,
  { eyes: EyeKind; brows: string[]; tilt: number; blush: boolean }
> = {
  normal: {
    eyes: "open",
    brows: ["M74 78 Q85 73 95 77", "M105 77 Q115 73 126 78"],
    tilt: 0,
    blush: false,
  },
  explaining: {
    eyes: "open",
    brows: ["M74 75 Q85 69 95 74", "M105 74 Q115 69 126 75"],
    tilt: -2,
    blush: false,
  },
  challenge: {
    eyes: "narrow",
    brows: ["M74 77 Q85 76 95 80", "M105 76 Q116 69 127 74"],
    tilt: -4,
    blush: false,
  },
  shocked: {
    eyes: "wide",
    brows: ["M73 71 Q85 63 95 70", "M105 70 Q115 63 127 71"],
    tilt: 0,
    blush: true,
  },
  laughing: {
    eyes: "happy",
    brows: ["M74 75 Q85 70 95 75", "M105 75 Q115 70 126 75"],
    tilt: 4,
    blush: true,
  },
  victory: {
    eyes: "open",
    brows: ["M74 75 Q85 70 95 74", "M105 74 Q115 70 126 75"],
    tilt: 3,
    blush: true,
  },
  fired: {
    eyes: "narrow",
    brows: ["M74 73 L95 80", "M105 80 L126 73"],
    tilt: 0,
    blush: false,
  },
  sleepy: {
    eyes: "sleepy",
    brows: ["M75 79 Q85 78 95 80", "M105 80 Q115 78 125 79"],
    tilt: 6,
    blush: false,
  },
};

function Eye({
  cx,
  cy,
  kind,
  id,
}: {
  cx: number;
  cy: number;
  kind: EyeKind;
  id: string;
}) {
  if (kind === "happy") {
    return (
      <path
        d={`M${cx - 9} ${cy + 2} Q${cx} ${cy - 8} ${cx + 9} ${cy + 2}`}
        fill="none"
        stroke={C.lash}
        strokeWidth={3}
        strokeLinecap="round"
      />
    );
  }
  const wide = kind === "wide";
  const ry = wide ? 10.6 : 9;
  const irisRx = wide ? 4.8 : 7;
  const irisRy = wide ? 5.6 : 8.2;
  const pupil = wide ? 1.7 : 3;
  const clip = `${id}-eye-${cx}`;
  return (
    <g>
      <clipPath id={clip}>
        <ellipse cx={cx} cy={cy} rx={10.4} ry={ry} />
      </clipPath>
      <ellipse cx={cx} cy={cy} rx={10.4} ry={ry} fill="#fff" />
      <g clipPath={`url(#${clip})`}>
        <ellipse
          cx={cx}
          cy={cy + 1}
          rx={irisRx}
          ry={irisRy}
          fill={`url(#${id}-iris)`}
        />
        <ellipse
          cx={cx}
          cy={cy + 1.5}
          rx={pupil}
          ry={pupil * 1.3}
          fill={C.pupil}
        />
        <circle cx={cx + 2.4} cy={cy - 2.6} r={wide ? 1.4 : 2} fill="#fff" />
        <circle cx={cx - 2} cy={cy + 3.4} r={0.9} fill="#fff" opacity={0.85} />
        {(kind === "narrow" || kind === "sleepy") && (
          <rect
            x={cx - 11}
            y={cy - 11}
            width={22}
            height={kind === "sleepy" ? 12 : 8}
            fill={C.skin}
          />
        )}
      </g>
      {/* upper lash line (follows the lid when narrowed/sleepy) */}
      <path
        d={
          kind === "sleepy"
            ? `M${cx - 10.5} ${cy + 1.5} Q${cx} ${cy - 0.5} ${cx + 10.5} ${cy + 1}`
            : kind === "narrow"
              ? `M${cx - 11} ${cy - 1} Q${cx} ${cy - 5} ${cx + 11} ${cy - 2}`
              : `M${cx - 11} ${cy - 1.5} Q${cx} ${cy - (wide ? 17 : 15)} ${cx + 11} ${cy - 2.5}`
        }
        fill="none"
        stroke={C.lash}
        strokeWidth={2.9}
        strokeLinecap="round"
      />
      <path
        d={`M${cx - 7} ${cy + 7.2} Q${cx} ${cy + 9} ${cx + 7} ${cy + 7.2}`}
        fill="none"
        stroke={C.lash}
        strokeOpacity={0.3}
        strokeWidth={1}
        strokeLinecap="round"
      />
    </g>
  );
}

function Mouth({ expression }: { expression: NiroExpression }) {
  const stroke = {
    fill: "none",
    stroke: C.mouth,
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
  };
  switch (expression) {
    case "explaining":
      return (
        <path d="M93 113 Q100 121 107 113 Q100 116 93 113 Z" fill={C.mouth} />
      );
    case "challenge":
      return <path d="M93 115 Q101 117.5 108 110.5" {...stroke} />;
    case "shocked":
      return <ellipse cx={100} cy={117} rx={3.4} ry={4.4} fill={C.mouth} />;
    case "laughing":
      return (
        <g>
          <path d="M89 110 Q100 126 111 110 Z" fill={C.mouth} />
          <path
            d="M94 117.5 Q100 122 106 117.5 Q100 115.5 94 117.5 Z"
            fill={C.tongue}
          />
        </g>
      );
    case "victory":
      return (
        <g>
          <path d="M90 110.5 Q100 123 110 110.5 Z" fill={C.mouth} />
          <path d="M91.5 111 L108.5 111 L107 113 L93 113 Z" fill="#fff" />
        </g>
      );
    case "fired":
      return (
        <g>
          <path
            d="M90 111 L110 111 Q100 120 90 111 Z"
            fill="#fff"
            stroke={C.mouth}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <path
            d="M100 111 L100 114.5"
            stroke={C.mouth}
            strokeOpacity={0.4}
            strokeWidth={1}
          />
        </g>
      );
    case "sleepy":
      return <path d="M97 116 Q100 117.6 103 116" {...stroke} />;
    default:
      return <path d="M93 113.5 Q100 119 107 113.5" {...stroke} />;
  }
}

function Spark({
  x,
  y,
  s,
  id,
}: {
  x: number;
  y: number;
  s: number;
  id: string;
}) {
  // The Niro Spark drawn inside the character (same shape as NiroSpark).
  // Positioned by the outer group's transform attribute; the CSS pulse
  // animates only the inner group (a CSS transform would override the
  // attribute and throw the spark to the corner).
  return (
    <g transform={`translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})`}>
      <g className="niro-char-spark">
        <circle cx="12" cy="12" r="11" fill={`url(#${id}-glow)`} />
        <path
          d="M12 1.5c.9 5.4 3.3 8 8.6 10.5-5.3 2.5-7.7 5.1-8.6 10.5-.9-5.4-3.3-8-8.6-10.5C8.7 9.5 11.1 6.9 12 1.5Z"
          fill={`url(#${id}-spark)`}
        />
        <circle cx="12" cy="12" r="2.1" fill={C.lime} />
      </g>
    </g>
  );
}

function Pose({ expression, id }: { expression: NiroExpression; id: string }) {
  if (expression === "explaining") {
    // Raised hand, index finger up, the Spark at the fingertip.
    return (
      <g>
        <path
          d="M28 220 C28 198 33 180 41 166"
          fill="none"
          stroke={C.hoodie}
          strokeWidth={22}
          strokeLinecap="round"
        />
        <circle cx={42} cy={165} r={11.5} fill={C.hoodieLight} />
        <rect x={38.3} y={122} width={7.4} height={26} rx={3.7} fill={C.skin} />
        <ellipse cx={42.5} cy={151} rx={9.2} ry={9.8} fill={C.skin} />
        <ellipse
          cx={51.5}
          cy={150}
          rx={3.4}
          ry={6.2}
          transform="rotate(-24 51.5 150)"
          fill={C.skin}
        />
        <path
          d="M36 148 Q42 146 48 148"
          fill="none"
          stroke={C.skinShade}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <Spark x={42} y={112} s={20} id={id} />
      </g>
    );
  }
  if (expression === "victory") {
    // ✌️ by his face.
    return (
      <g>
        <path
          d="M172 220 C172 198 167 180 159 166"
          fill="none"
          stroke={C.hoodie}
          strokeWidth={22}
          strokeLinecap="round"
        />
        <circle cx={158} cy={165} r={11.5} fill={C.hoodieLight} />
        <rect
          x={149}
          y={121}
          width={7.4}
          height={27}
          rx={3.7}
          transform="rotate(-14 152.7 147)"
          fill={C.skin}
        />
        <rect
          x={159}
          y={120}
          width={7.4}
          height={28}
          rx={3.7}
          transform="rotate(12 162.7 147)"
          fill={C.skin}
        />
        <ellipse cx={158} cy={151} rx={9.4} ry={9.8} fill={C.skin} />
        <ellipse
          cx={148.8}
          cy={152}
          rx={3.4}
          ry={6}
          transform="rotate(26 148.8 152)"
          fill={C.skin}
        />
        <Spark x={176} y={112} s={16} id={id} />
      </g>
    );
  }
  if (expression === "fired") {
    return (
      <g className="niro-char-energy">
        <path
          d="M44 58 L52 50 L50 60 L58 54"
          fill="none"
          stroke={C.cyan}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M156 54 L148 46 L150 56 L142 50"
          fill="none"
          stroke={C.lime}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Spark x={160} y={84} s={14} id={id} />
      </g>
    );
  }
  if (expression === "shocked") {
    return <path d="M141 62 Q146 71 141 76 Q136 71 141 62 Z" fill="#7dd3fc" />;
  }
  if (expression === "sleepy") {
    return (
      <g
        fill={C.hoodieLight}
        fontWeight={800}
        fontFamily="system-ui, sans-serif"
        className="niro-char-zz"
      >
        <text x={142} y={58} fontSize={13}>
          z
        </text>
        <text x={152} y={46} fontSize={17}>
          Z
        </text>
      </g>
    );
  }
  return null;
}

export default function NiroCharacter({
  expression = "normal",
  size = 160,
  crop = "bust",
  animated = true,
  className,
  label,
}: {
  expression?: NiroExpression;
  size?: number; // rendered width in px
  crop?: "bust" | "head";
  animated?: boolean;
  className?: string;
  // Accessible name; omit when purely decorative next to text.
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const classes = `niro-character niro-${expression}${animated ? " is-animated" : ""}${className ? ` ${className}` : ""}`;
  const raster = niroAssetFor(crop === "head" ? "avatar" : expression);
  if (raster) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={raster}
        width={size}
        alt={label ?? ""}
        aria-hidden={label ? undefined : true}
        className={classes}
      />
    );
  }

  const look = LOOK[expression];
  const viewBox = crop === "head" ? "54 30 92 92" : "0 0 200 220";
  const height = crop === "head" ? size : Math.round((size * 220) / 200);
  const bust = crop === "bust";

  return (
    <svg
      width={size}
      height={height}
      viewBox={viewBox}
      className={classes}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-iris`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d4ed8" />
          <stop offset="0.55" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#67e8f9" />
        </linearGradient>
        <linearGradient id={`${id}-spark`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#67e8f9" stopOpacity="0.6" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-hoodie`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.hoodieLight} />
          <stop offset="0.35" stopColor={C.hoodie} />
          <stop offset="1" stopColor={C.hoodieDark} />
        </linearGradient>
      </defs>

      <g className="niro-float">
        {/* back hair */}
        <path
          d="M56 92 C52 52 74 28 100 28 C126 28 148 52 144 92 C144 104 141 114 136 121 C133 113 131 107 128 103 L72 103 C69 107 67 113 64 121 C59 114 56 104 56 92 Z"
          fill={C.hair}
        />

        {bust && (
          <>
            {/* hood behind the neck, neck, hoodie */}
            <path
              d="M44 220 C44 178 66 150 100 150 C134 150 156 178 156 220 Z"
              fill={C.hoodieDark}
            />
            <path
              d="M89 124 L111 124 L112 150 Q100 158 88 150 Z"
              fill={C.skinShade}
            />
            <path
              d="M14 220 C18 186 42 164 76 156 Q100 174 124 156 C158 164 182 186 186 220 Z"
              fill={`url(#${id}-hoodie)`}
            />
            <path
              d="M72 157 Q100 187 128 157"
              fill="none"
              stroke={C.hoodieLight}
              strokeWidth={7}
              strokeLinecap="round"
            />
            <path
              d="M91 171 L89 199 M109 171 L111 199"
              stroke={C.cyan}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <circle cx={89} cy={201} r={2.4} fill={C.cyan} />
            <circle cx={111} cy={201} r={2.4} fill={C.cyan} />
            <path
              d="M66 214 Q100 205 134 214"
              fill="none"
              stroke={C.hoodieDark}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <Spark x={134} y={190} s={13} id={id} />
          </>
        )}

        <g transform={`rotate(${look.tilt} 100 120)`}>
          {/* ears + face */}
          <ellipse cx={64} cy={92} rx={5} ry={8} fill={C.skinShade} />
          <ellipse cx={136} cy={92} rx={5} ry={8} fill={C.skinShade} />
          <path
            d="M64 84 C64 58 80 42 100 42 C120 42 136 58 136 84 C136 104 128 120 114 129 Q100 137 86 129 C72 120 64 104 64 84 Z"
            fill={C.skin}
          />

          {look.blush && (
            <g fill={C.blush} opacity={0.45}>
              <ellipse cx={76} cy={104} rx={6} ry={3} />
              <ellipse cx={124} cy={104} rx={6} ry={3} />
            </g>
          )}

          <g className={look.eyes === "happy" ? undefined : "niro-eyes"}>
            <Eye cx={85} cy={95} kind={look.eyes} id={id} />
            <Eye cx={115} cy={95} kind={look.eyes} id={id} />
          </g>
          <path
            d="M100 101 Q98.4 105 100.6 106"
            fill="none"
            stroke={C.skinShade}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <Mouth expression={expression} />

          {/* front hair: messy fringe, side locks, ahoge, the cyan strand */}
          <path
            d="M58 88 C54 54 76 32 102 32 C128 32 148 54 142 88 C138 80 135 74 130 70 C130 76 128 80 124 84 C121 76 117 70 111 66 C111 72 108 78 103 82 C101 74 96 68 90 64 C90 70 86 76 81 80 C79 73 75 69 70 67 C69 74 66 80 62 84 Z"
            fill={C.hair}
          />
          <path
            d="M62 84 C58 100 60 114 66 124 C66 110 68 98 70 88 Z"
            fill={C.hair}
          />
          <path
            d="M138 84 C142 100 140 114 134 124 C134 110 132 98 130 88 Z"
            fill={C.hair}
          />
          <path
            d="M100 33 C95 22 102 15 111 13 C105 20 105 26 107 34 Z"
            fill={C.hair}
          />
          <path
            d="M78 46 Q90 38 104 40"
            fill="none"
            stroke={C.hairHi}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.8}
          />
          {/* brows over the fringe (anime convention) — stay readable */}
          <g transform="translate(0 4)">
            {look.brows.map(d => (
              <path
                key={d}
                d={d}
                fill="none"
                stroke={C.lash}
                strokeWidth={3}
                strokeLinecap="round"
              />
            ))}
          </g>
          <g className="niro-strand">
            <path
              d="M101 33 C112 39 118 54 112 80 C110 71 107 64 103 59 C105 50 104 41 101 33 Z"
              fill={C.cyan}
            />
            <path
              d="M105 40 C111 47 113 57 111 68"
              fill="none"
              stroke={C.cyanHi}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </g>
        </g>

        {bust && <Pose expression={expression} id={id} />}
      </g>
    </svg>
  );
}
