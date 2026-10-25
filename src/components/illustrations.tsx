/* Flat cartoon illustrations in the spirit of the shop's original menu boards.
 * Pure SVG (no external assets) so html-to-image captures them exactly. */

const INK = "#1f3b2d";
const S = { stroke: INK, strokeWidth: 4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

type Art = (p: { size: number }) => React.ReactElement;

const Tv: Art = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
    <path d="M78 42 100 62 126 34" fill="none" {...S} />
    <circle cx="100" cy="64" r="7" fill="#f6c453" {...S} />
    <rect x="28" y="66" width="144" height="100" rx="18" fill="#f28b6e" {...S} />
    <rect x="42" y="80" width="96" height="72" rx="12" fill="#dff3f7" {...S} />
    <path d="M52 92q10-6 22 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    <circle cx="155" cy="92" r="6" fill="#fff" {...S} />
    <circle cx="155" cy="112" r="6" fill="#fff" {...S} />
    <path d="M148 132h14M148 142h14" {...S} />
    <path d="M52 166l-6 14h18l4-14M148 166l6 14h-18l-4-14" fill="#9ca3af" {...S} />
  </svg>
);

const Fridge: Art = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
    <rect x="52" y="18" width="96" height="166" rx="14" fill="#a8d5b5" {...S} />
    <path d="M52 78h96" {...S} />
    <path d="M66 40v22M66 96v34" stroke={INK} strokeWidth="7" strokeLinecap="round" />
    <rect x="104" y="92" width="22" height="16" rx="3" fill="#f6c453" {...S} />
    <rect x="96" y="118" width="30" height="20" rx="3" fill="#fff" {...S} />
    <circle cx="124" cy="44" r="7" fill="#f28b6e" {...S} />
    <path d="M60 184v8M140 184v8" {...S} />
  </svg>
);

const Washer: Art = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
    <rect x="34" y="24" width="132" height="156" rx="14" fill="#f8f5ec" {...S} />
    <path d="M34 58h132" {...S} />
    <circle cx="58" cy="41" r="6" fill="#f28b6e" {...S} />
    <circle cx="78" cy="41" r="6" fill="#a8d5b5" {...S} />
    <rect x="108" y="34" width="44" height="14" rx="5" fill="#dff3f7" {...S} />
    <circle cx="100" cy="118" r="46" fill="#cfd8dc" {...S} />
    <circle cx="100" cy="118" r="33" fill="#7cc4e4" {...S} />
    <path d="M70 124q15-12 30 0t30 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    <circle cx="88" cy="104" r="5" fill="#fff" />
  </svg>
);

const Board: Art = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
    <rect x="22" y="40" width="156" height="120" rx="10" fill="#3a9e1d" {...S} />
    <g fill="none" stroke="#bbe3a9" strokeWidth="4" strokeLinecap="round">
      <path d="M40 60h30v30M160 70h-28v26M40 140h40v-20M160 140h-34" />
    </g>
    <rect x="76" y="74" width="48" height="48" rx="6" fill="#263238" {...S} />
    <g stroke="#f6c453" strokeWidth="4" strokeLinecap="round">
      <path d="M84 66v8M96 66v8M108 66v8M120 66v8M84 122v8M96 122v8M108 122v8M120 122v8" />
    </g>
    <circle cx="100" cy="98" r="8" fill="#f6c453" />
    {[[44, 116], [150, 112], [140, 52]].map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill="#f6c453" {...S} />
    ))}
  </svg>
);

const Laptop: Art = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
    <rect x="44" y="40" width="112" height="80" rx="10" fill="#cfd8dc" {...S} />
    <rect x="54" y="50" width="92" height="60" rx="5" fill="#7cc4e4" {...S} />
    <g transform="translate(82 60) scale(0.56)" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 20l5-8a3 3 0 0 1 5 0l5 8M45 31l5 8a3 3 0 0 1-2.6 4.5H38M26 43.5H16.6A3 3 0 0 1 14 39l5-8" />
    </g>
    <path d="M24 132h152l-10 20H34z" fill="#9ca3af" {...S} />
    <path d="M86 140h28" {...S} />
  </svg>
);

const Fan: Art = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
    <path d="M100 116v50" stroke={INK} strokeWidth="8" strokeLinecap="round" />
    <ellipse cx="100" cy="174" rx="40" ry="10" fill="#f28b6e" {...S} />
    <circle cx="100" cy="76" r="58" fill="#dff3f7" {...S} />
    <g fill="#a8d5b5" {...S}>
      <path d="M100 76c-6-26 4-40 18-38 14 4 12 22-18 38z" />
      <path d="M100 76c26-6 40 4 38 18-4 14-22 12-38-18z" />
      <path d="M100 76c6 26-4 40-18 38-14-4-12-22 18-38z" />
      <path d="M100 76c-26 6-40-4-38-18 4-14 22-12 38 18z" />
    </g>
    <circle cx="100" cy="76" r="9" fill="#f6c453" {...S} />
  </svg>
);

const Coins: Art = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
    <path d="M62 70q38-26 76 0l14 70q-52 36-104 0z" fill="#f6c453" {...S} />
    <path d="M78 66q22-20 44 0" fill="none" {...S} />
    <path d="M84 48q16 8 32 0" fill="none" {...S} />
    <text x="100" y="128" textAnchor="middle" fontSize="48" fontWeight="700" fill={INK} fontFamily="sans-serif">฿</text>
    <ellipse cx="150" cy="160" rx="26" ry="10" fill="#f6c453" {...S} />
    <ellipse cx="150" cy="148" rx="26" ry="10" fill="#fbd977" {...S} />
    <ellipse cx="46" cy="164" rx="22" ry="9" fill="#fbd977" {...S} />
  </svg>
);

const Bin: Art = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
    <path d="M52 64h96l-10 112H62z" fill="#3a9e1d" {...S} />
    <rect x="42" y="46" width="116" height="20" rx="8" fill="#64b947" {...S} />
    <path d="M84 46v-8h32v8" fill="none" {...S} />
    <g transform="translate(72 92) scale(0.88)" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 20l5-8a3 3 0 0 1 5 0l5 8M36 17l3 3-4 1M45 31l5 8a3 3 0 0 1-2.6 4.5H38M41 47l-3-3.5 3-3M26 43.5H16.6A3 3 0 0 1 14 39l5-8M15 31.5l4-.5 1 4" />
    </g>
  </svg>
);

const Sparkle = ({ x, y, s, c }: { x: number; y: number; s: number; c: string }) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10z"
    fill={c}
    stroke={INK}
    strokeWidth={2.5 / s}
    strokeLinejoin="round"
  />
);

const ART = { tv: Tv, fridge: Fridge, washer: Washer, board: Board, laptop: Laptop, fan: Fan, coins: Coins, bin: Bin };
type ArtKey = keyof typeof ART;

/** Pick illustrations that match the menu's main categories. */
export function artFor(mainNames: string[]): ArtKey[] {
  const text = mainNames.join(" ");
  const picks: ArtKey[] = [];
  if (/บอร์ด|คอม|อิเล็ก|ชิป|cpu|แรม/i.test(text)) picks.push("board", "laptop");
  if (/ไฟฟ้า|ทีวี|จอ|ตู้เย็น|ซักผ้า|พัดลม/.test(text)) picks.push("tv", "fridge", "washer", "fan");
  picks.push("coins", "bin");
  return [...new Set(picks)];
}

/**
 * A ground strip with several illustrations, sized to fill a free area of `width × height` px.
 * Renders nothing when the space is too small to look intentional.
 */
export function IllustrationScene({ width, height, art }: { width: number; height: number; art: ArtKey[] }) {
  if (height < 150 || width < 300) return null;
  const size = Math.min(height * 0.82, 300);
  const count = Math.max(2, Math.min(art.length, Math.floor(width / (size * 0.9))));
  const items = art.slice(0, count);
  const gap = (width - items.length * size) / (items.length + 1);
  return (
    <div style={{ width, height }} className="relative">
      <svg width={width} height={height} className="absolute inset-0" aria-hidden>
        <ellipse cx={width / 2} cy={height - 16} rx={width * 0.46} ry={16} fill="#3a9e1d" opacity="0.12" />
        <Sparkle x={width * 0.08} y={height * 0.25} s={1.6} c="#f6c453" />
        <Sparkle x={width * 0.93} y={height * 0.18} s={1.2} c="#f28b6e" />
        <Sparkle x={width * 0.52} y={height * 0.1} s={1} c="#a8d5b5" />
      </svg>
      {items.map((key, i) => {
        const A = ART[key];
        // alternate sizes for a hand-arranged look
        const s = i % 2 ? size * 0.82 : size;
        return (
          <div key={key} className="absolute" style={{ left: gap + i * (size + gap) + (size - s) / 2, bottom: 6 }}>
            <A size={s} />
          </div>
        );
      })}
    </div>
  );
}
