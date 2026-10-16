/*
 * Фирменная графика «Такояки»: знак с шариком такояки и большая иллюстрация
 * «порция такояки» для главной. Всё нарисовано SVG — без внешних файлов.
 */

/** Знак: шарик такояки с соусом и майонезом на фирменной плашке. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id="bm-crust" cx="38%" cy="36%" r="70%">
          <stop offset="0%" stopColor="#ffd38a" />
          <stop offset="55%" stopColor="#e39a45" />
          <stop offset="100%" stopColor="#a85a1c" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="12" fill="var(--accent)" />
      <circle cx="20" cy="21.5" r="11" fill="url(#bm-crust)" />
      <path d="M9.6 18.4c2.4-4.8 6.2-7.1 10.4-7.1s8 2.3 10.4 7.1c-1.8 1.9-3.7 2.4-5.4 1.4-1.5 1.7-3.2 2.3-5 1.2-1.7 1.1-3.4.5-5-1.2-1.7 1-3.6.5-5.4-1.4z" fill="#4a1d0c" />
      <path d="M12.2 17.2l2.7 1.6 2.5-1.8 2.6 1.8 2.6-1.8 2.5 1.8 2.7-1.6" fill="none" stroke="#fff8e8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="13.8" r=".9" fill="#7fb24a" />
      <circle cx="23.4" cy="13.4" r=".9" fill="#7fb24a" />
    </svg>
  );
}

/* ---------- Большая иллюстрация ---------- */

/** Стружка кацуобуси: тонкий завиток, «танцует» от жара (анимация в CSS). */
function Flake({ x, y, r = 0, s = 1, d = 0 }: { x: number; y: number; r?: number; s?: number; d?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s * 1.35})`}>
      <g className="tk-flake" style={{ animationDelay: `${d}s` }}>
        <path d="M-11 2c3-7 10-9 16-6 4 2 6 6 4 9-4-3-8-4-12-2-3 1-5 2-8-1z" fill="#f2c7ad" />
        <path d="M-11 2c3-7 10-9 16-6 4 2 6 6 4 9" fill="none" stroke="#c98d72" strokeWidth=".9" strokeLinecap="round" />
        <path d="M-6 0c3-3 7-4 10-2" fill="none" stroke="#e3a98e" strokeWidth=".7" strokeLinecap="round" />
      </g>
    </g>
  );
}

/** Один шарик такояки: хрустящая корочка, глянцевый соус с потёками, майонез, аонори. */
function Ball({ x, y, s = 1, mayo = 0 }: { x: number; y: number; s?: number; mayo?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* корочка */}
      <circle r="40" fill="url(#tk-crust)" />
      <circle r="40" fill="url(#tk-crisp-pat)" />
      <ellipse cx="-14" cy="14" rx="11" ry="6" fill="#b8672a" opacity=".4" />
      <ellipse cx="18" cy="20" rx="8" ry="4.5" fill="#a2561e" opacity=".35" />
      <ellipse cx="-20" cy="2" rx="7" ry="4" fill="#ffe3a8" opacity=".45" />
      <g fill="#9a4f16" opacity=".45">
        <circle cx="-4" cy="10" r="1.6" /><circle cx="8" cy="4" r="1.2" /><circle cx="-26" cy="16" r="1.3" />
        <circle cx="24" cy="6" r="1.4" /><circle cx="2" cy="26" r="1.5" /><circle cx="-10" cy="28" r="1.1" />
      </g>
      {/* соус с потёками */}
      <path
        d="M-35-15C-29-31-15-38 0-38S29-31 35-15c-3 3-6 2-8-1-2 8-5 9-7 2-3 3-5 2-7-2-2 9-6 9-7 0-3 2-5 2-6-2-2 6-5 6-7 0-3 3-6 3-8-1z"
        fill="url(#tk-sauce)"
      />
      <path d="M-22-28c6-5 12-6 19-6" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" />
      <circle cx="-27" cy="-20" r="1.8" fill="#fff" opacity=".5" />
      {/* майонез */}
      <g transform={`rotate(${mayo})`}>
        <path d="M-25-24l6 4 6-5 6 5 6-5 6 5 6-5 6 4" fill="none" stroke="#c9a77c" strokeOpacity=".45" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 2)" />
        <path d="M-25-24l6 4 6-5 6 5 6-5 6 5 6-5 6 4" fill="none" stroke="#fffaf0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-23-24l4 3M-11-24l4 3M1-24l4 3M13-24l4 3" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".9" />
      </g>
      {/* аонори */}
      <g fill="#6b9a34">
        <circle cx="-14" cy="-30" r="1.5" />
        <circle cx="-3" cy="-33" r="1.2" />
        <circle cx="9" cy="-31" r="1.6" />
        <circle cx="21" cy="-26" r="1.2" />
        <circle cx="-22" cy="-17" r="1.1" />
        <circle cx="4" cy="-16" r="1.1" />
        <circle cx="16" cy="-17" r="1" />
      </g>
    </g>
  );
}

/** Иллюстрация: тёмная тарелка, бумажная лодочка с семью такояки, кацуобуси, шпажка и пар. */
export function TakoyakiIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 420 320" aria-hidden="true">
      <defs>
        <radialGradient id="tk-crust" cx="36%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#ffd98a" />
          <stop offset="35%" stopColor="#f2a447" />
          <stop offset="75%" stopColor="#c8681c" />
          <stop offset="100%" stopColor="#7c3a0d" />
        </radialGradient>
        <linearGradient id="tk-sauce" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a3214" />
          <stop offset="100%" stopColor="#3e150a" />
        </linearGradient>
        <linearGradient id="tk-boat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8c896" />
          <stop offset="100%" stopColor="#c99a5e" />
        </linearGradient>
        <radialGradient id="tk-plate" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#3a2219" />
          <stop offset="100%" stopColor="#1f120c" />
        </radialGradient>
        {/* хрустящая фактура: редкие подрумяненные крапинки */}
        <pattern id="tk-crisp-pat" width="14" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <circle cx="3" cy="3" r="1.3" fill="#a85a1c" opacity=".55" />
          <circle cx="10" cy="8" r="1" fill="#ffd98e" opacity=".5" />
          <circle cx="8" cy="2" r=".7" fill="#8e4813" opacity=".5" />
        </pattern>
        <filter id="tk-soft" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      {/* тарелка и тень */}
      <ellipse cx="214" cy="272" rx="190" ry="34" fill="#4a2410" opacity=".28" filter="url(#tk-soft)" />
      <ellipse cx="210" cy="252" rx="196" ry="52" fill="url(#tk-plate)" />
      <ellipse cx="210" cy="246" rx="176" ry="40" fill="none" stroke="#5a3a2c" strokeWidth="2" opacity=".7" />

      {/* лодочка — задний борт */}
      <path d="M50 176h320l-10 14H60z" fill="#b8874d" />

      {/* задний ряд */}
      <Ball x={124} y={158} s={1} mayo={-4} />
      <Ball x={210} y={150} s={1.04} mayo={3} />
      <Ball x={296} y={158} s={1} mayo={-2} />

      {/* передний ряд */}
      <Ball x={84} y={206} s={1.1} mayo={2} />
      <Ball x={168} y={214} s={1.1} mayo={-3} />
      <Ball x={252} y={214} s={1.1} mayo={4} />
      <Ball x={336} y={206} s={1.1} mayo={-1} />

      {/* лодочка — передний борт */}
      <path d="M36 236h348l-20 22c-3 4-8 6-13 6H69c-5 0-10-2-13-6z" fill="url(#tk-boat)" />
      <path d="M36 236h348l-4 6H40z" fill="#d6ad74" />
      <path d="M70 252h280" stroke="#b98a52" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />

      {/* кацуобуси */}
      <Flake x={110} y={126} r={-18} d={0} />
      <Flake x={142} y={118} r={22} s={0.9} d={0.4} />
      <Flake x={200} y={112} r={-6} s={1.1} d={0.9} />
      <Flake x={232} y={118} r={30} s={0.85} d={0.2} />
      <Flake x={286} y={124} r={-24} d={0.6} />
      <Flake x={312} y={132} r={14} s={0.8} d={1.1} />
      <Flake x={80} y={160} r={8} s={0.85} d={0.7} />
      <Flake x={160} y={164} r={-30} s={0.9} d={0.3} />
      <Flake x={258} y={162} r={18} s={0.95} d={1.3} />
      <Flake x={338} y={158} r={-12} s={0.85} d={0.5} />

      {/* шпажка */}
      <path d="M352 182L404 78" stroke="#ead8b2" strokeWidth="5" strokeLinecap="round" />
      <path d="M352 182L404 78" stroke="#c7ad7e" strokeWidth="1.5" strokeLinecap="round" transform="translate(2 1)" opacity=".6" />

      {/* пар */}
      <g className="tk-steam" fill="none" stroke="#c98a4e" strokeWidth="4" strokeLinecap="round">
        <path d="M150 104c-10-14 10-22 0-38" style={{ animationDelay: '0s' }} />
        <path d="M212 94c-10-14 10-22 0-38" style={{ animationDelay: '1.1s' }} />
        <path d="M274 104c-10-14 10-22 0-38" style={{ animationDelay: '2.2s' }} />
      </g>
    </svg>
  );
}
