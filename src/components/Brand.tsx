/*
 * Фирменная графика «Такояки»: знак-печать (ханко) с шариком такояки и иллюстрация
 * «лодочка с такояки» для приветственного экрана. Всё нарисовано SVG — без внешних файлов.
 */

/** Знак: красная печать со скруглёнными углами, внутри шарик такояки с соусом и майонезом. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="var(--accent)" />
      <rect x="4" y="4" width="32" height="32" rx="7.5" fill="none" stroke="#fff6e6" strokeOpacity=".55" strokeWidth="1.2" />
      <circle cx="20" cy="21.5" r="10.5" fill="#e8b067" />
      <path d="M10.2 18.6c2.4-4.6 6-6.8 9.8-6.8s7.4 2.2 9.8 6.8c-1.8 1.8-3.6 2.4-5.2 1.4-1.4 1.6-3 2.2-4.6 1.2-1.6 1-3.2.4-4.6-1.2-1.6 1-3.4.4-5.2-1.4z" fill="#5a2716" />
      <path d="M12.5 17.5l2.6 1.6 2.4-1.8 2.5 1.8 2.5-1.8 2.4 1.8 2.6-1.6" fill="none" stroke="#fff6e6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="25.5" r=".9" fill="#c98a3e" />
      <circle cx="23.5" cy="27" r=".9" fill="#c98a3e" />
    </svg>
  );
}

function Ball({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.14)`}>
      <circle r="17" fill="#e8b067" />
      <circle r="17" fill="url(#tk-shade)" />
      <path d="M-15.5-4c3.6-8 9.4-11.5 15.5-11.5S11.9-12 15.5-4c-2.6 2.6-5.4 3.2-7.6 1.6-2.2 2.4-5 3-7.9 1.4-2.9 1.6-5.7 1-7.9-1.4-2.2 1.6-5 1-7.6-1.6z" fill="#5a2716" />
      <path d="M-11-6.5l3.6 2.4 3.6-2.6 3.8 2.6 3.8-2.6 3.6 2.6 3.6-2.4" fill="none" stroke="#fff6e6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="-6" cy="-10" r="1.1" fill="#5c8a3a" />
      <circle cx="4" cy="-11.5" r="1.1" fill="#5c8a3a" />
      <circle cx="9" cy="-8" r="1.1" fill="#5c8a3a" />
    </g>
  );
}

/** Иллюстрация: деревянная лодочка-подставка с шариками такояки, шпажка и пар. */
export function TakoyakiIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 260 170" aria-hidden="true">
      <defs>
        <radialGradient id="tk-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff2d6" stopOpacity=".55" />
          <stop offset="60%" stopColor="#e8b067" stopOpacity="0" />
          <stop offset="100%" stopColor="#9a5a22" stopOpacity=".45" />
        </radialGradient>
      </defs>
      {/* пар */}
      <g fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round">
        <path d="M92 30c-6-8 6-12 0-20" />
        <path d="M130 26c-6-8 6-12 0-20" />
        <path d="M168 30c-6-8 6-12 0-20" />
      </g>
      {/* лодочка */}
      <path d="M22 108h216l-22 40c-2 4-6 6-10 6H54c-4 0-8-2-10-6z" fill="#c9965c" />
      <path d="M22 108h216l-4 8H26z" fill="#b07c45" />
      <path d="M40 128h180M48 140h164" stroke="#a87440" strokeWidth="2" strokeLinecap="round" opacity=".6" />
      {/* шарики */}
      <Ball x={78} y={86} />
      <Ball x={130} y={84} />
      <Ball x={182} y={86} />
      <Ball x={56} y={100} />
      <Ball x={104} y={102} />
      <Ball x={156} y={102} />
      <Ball x={204} y={100} />
      {/* шпажка */}
      <path d="M196 70l44-46" stroke="#e9d3a8" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
