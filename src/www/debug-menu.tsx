import React from "react";
import type { IVisualization, DebugParam } from "../shared/viz/visualization-type.ts";

function hasDebugParams(
  viz: IVisualization
): viz is IVisualization & { debugParams: Record<string, DebugParam> } {
  return "debugParams" in viz;
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function sliderProps(p: DebugParam): { min: number; max: number; step: number } {
  if (p.type === "time") {
    return { min: 0, max: 86400, step: 60 };
  }
  return { min: p.min, max: p.max, step: p.increment };
}

function defaultValue(p: DebugParam): number {
  if (p.type === "time") return 43200;
  return (p.min + p.max) / 2;
}

function formatValue(p: DebugParam, v: number): string {
  if (p.type === "time") return formatSeconds(v);
  if (p.increment >= 1) return Math.round(v).toString();
  return v.toFixed(2);
}

export function DebugMenu({ viz }: { viz: IVisualization }) {
  if (!hasDebugParams(viz)) return null;

  const params = viz.debugParams;
  const keys = Object.keys(params);
  if (keys.length === 0) return null;

  const [enabled, setEnabled] = React.useState<Record<string, boolean>>({});
  const [values, setValues] = React.useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const key of keys) {
      initial[key] = defaultValue(params[key]);
    }
    return initial;
  });

  React.useEffect(() => {
    for (const key of keys) {
      params[key].value = enabled[key] ? values[key] : -1;
    }
  }, [enabled, values]);

  React.useEffect(() => {
    return () => {
      for (const key of keys) {
        params[key].value = -1;
      }
    };
  }, []);

  return (
    <div
      style={styles.container}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {keys.map((key) => {
        const p = params[key];
        const sp = sliderProps(p);
        return (
          <div key={key} style={styles.row}>
            <label style={styles.label}>
              <input
                type="checkbox"
                checked={!!enabled[key]}
                onChange={(e) =>
                  setEnabled((prev) => ({ ...prev, [key]: e.target.checked }))
                }
                style={styles.checkbox}
              />
              {key}
            </label>
            <input
              type="range"
              min={sp.min}
              max={sp.max}
              step={sp.step}
              value={values[key]}
              disabled={!enabled[key]}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [key]: parseFloat(e.target.value),
                }))
              }
              style={styles.slider}
            />
            <span style={styles.value}>
              {formatValue(p, values[key])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    right: "100%",
    top: 0,
    background: "rgba(0, 0, 0, 0.75)",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    whiteSpace: "nowrap",
    fontSize: "12px",
    fontFamily: "'Pixelify Sans', monospace",
    color: "#ccc",
    zIndex: 30,
    borderRadius: "4px 0 0 4px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    cursor: "pointer",
    minWidth: "80px",
  },
  checkbox: {
    margin: 0,
    cursor: "pointer",
  },
  slider: {
    width: "200px",
    cursor: "pointer",
  },
  value: {
    minWidth: "40px",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
};
