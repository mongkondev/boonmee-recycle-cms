export const RecycleMark = ({ size, className, style }: { size: number; className?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M24 20l5-8a3 3 0 0 1 5 0l5 8" />
    <path d="M36 17l3 3-4 1" />
    <path d="M45 31l5 8a3 3 0 0 1-2.6 4.5H38" />
    <path d="M41 47l-3-3.5 3-3" />
    <path d="M26 43.5H16.6A3 3 0 0 1 14 39l5-8" />
    <path d="M15 31.5l4-.5 1 4" />
  </svg>
);
