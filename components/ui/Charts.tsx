import styles from "@/components/dashboard/dashboard.module.css";

/** Lightweight server-rendered SVG charts: no client JS or chart dependency. */

export function AreaChart({
  points,
  label = "Portfolio value",
  height = 180,
}: {
  points: { label: string; value: number }[];
  label?: string;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Not enough history yet</p>
        <p className={styles.emptyText}>
          Your performance chart builds from daily snapshots. Return tomorrow to see the first comparison.
        </p>
      </div>
    );
  }

  const width = 640;
  const padding = 14;
  const values = points.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || Math.max(max, 1);
  const stepX = (width - padding * 2) / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = padding + index * stepX;
    const y = height - padding - ((point.value - min) / span) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${coords.join(" L")}`;
  const area = `${line} L${(padding + (points.length - 1) * stepX).toFixed(1)},${height - padding} L${padding},${height - padding} Z`;
  const first = points[0];
  const last = points[points.length - 1];
  const change = first.value === 0 ? 0 : ((last.value - first.value) / first.value) * 100;

  return (
    <figure style={{ margin: 0, display: "grid", gap: 8 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label}: ${points.length} points, change ${change.toFixed(2)} percent`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#50fa7b" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#50fa7b" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={padding}
            x2={width - padding}
            y1={padding + fraction * (height - padding * 2)}
            y2={padding + fraction * (height - padding * 2)}
            stroke="#e8eee8"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke="#0b6b33" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={padding} cy={coords[0].split(",")[1]} r="3" fill="#0b6b33" />
        <circle
          cx={padding + (points.length - 1) * stepX}
          cy={coords[coords.length - 1].split(",")[1]}
          r="3.6"
          fill="#50fa7b"
          stroke="#051509"
          strokeWidth="1.4"
        />
      </svg>
      <figcaption className={styles.muted} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span>
          {first.label} → {last.label}
        </span>
        <span style={{ color: change >= 0 ? "#146b32" : "#a12b2b", fontWeight: 700 }}>
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)}%
        </span>
      </figcaption>
    </figure>
  );
}

const DONUT_COLOURS = ["#0b6b33", "#50fa7b", "#8ab4f8", "#f5b942", "#c58af9", "#7b8a7d"];

export function AllocationDonut({ slices }: { slices: { label: string; percent: number; value: string }[] }) {
  if (slices.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No allocation yet</p>
        <p className={styles.emptyText}>Asset allocation appears once you hold positions or a funded wallet.</p>
      </div>
    );
  }

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const segments = slices.map((slice, index) => {
    const before = slices.slice(0, index).reduce((sum, entry) => sum + Math.max(0, entry.percent), 0);
    const value = Math.max(0, slice.percent);
    return {
      slice,
      length: (value / 100) * circumference,
      offset: (before / 100) * circumference,
    };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <svg viewBox="0 0 120 120" width="132" height="132" role="img" aria-label="Asset allocation">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#eef3ee" strokeWidth="16" />
        {segments.map((segment, index) => (
          <circle
            key={segment.slice.label}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={DONUT_COLOURS[index % DONUT_COLOURS.length]}
            strokeWidth="16"
            strokeDasharray={`${segment.length} ${circumference - segment.length}`}
            strokeDashoffset={-segment.offset}
            transform="rotate(-90 60 60)"
          />
        ))}
      </svg>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8, minWidth: 180 }}>
        {slices.map((slice, index) => (
          <li key={slice.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: DONUT_COLOURS[index % DONUT_COLOURS.length],
                flex: "0 0 10px",
              }}
            />
            <span style={{ textTransform: "capitalize", flex: 1 }}>{slice.label.replace(/_/g, " ")}</span>
            <span className={styles.muted}>{slice.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
