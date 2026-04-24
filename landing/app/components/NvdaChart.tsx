export default function NvdaChart({ closes }: { closes: number[] }) {
  if (!closes.length) return null;
  const W = 600;
  const H = 140;
  const pad = 6;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const rng = max - min || 1;
  const pts = closes.map((p, i) => {
    const x = pad + (i / (closes.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (p - min) / rng) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polygonPts = `${pad},${H - pad} ${pts.join(" ")} ${W - pad},${H - pad}`;
  const linePts = pts.join(" ");
  const grid = [1, 2, 3].map((i) => (H / 4) * i);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="gfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9361b" stopOpacity="0.25" />
          <stop offset="1" stopColor="#c9361b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((y, i) => (
        <line
          key={i}
          x1="0"
          x2={W}
          y1={y}
          y2={y}
          stroke="rgba(255,255,255,0.06)"
          strokeDasharray="2 4"
        />
      ))}
      <polygon fill="url(#gfill)" points={polygonPts} />
      <polyline fill="none" stroke="#c9361b" strokeWidth="1.5" points={linePts} />
    </svg>
  );
}
