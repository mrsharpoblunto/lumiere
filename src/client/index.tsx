import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { IVisualization } from "../shared/viz/visualization-type.ts";
import { FastAverageColorResult } from "fast-average-color";
import { Visualization, useVisualizations } from "../www/visualizations.tsx";

const LONGPOLL_TIMEOUT = 30000;
const AVERAGE_COLOR_BLEND = 0.1;

type RemoteState = {
  on: boolean;
  visualization: number;
};

function useRemoteState(): [
  RemoteState,
  React.Dispatch<React.SetStateAction<RemoteState>>
] {
  const [remoteState, setRemoteState] = React.useState<RemoteState>({
    on: false,
    visualization: -1,
  });
  const [polling, setPolling] = React.useState(false);

  const pollState = (state: RemoteState) => {
    const startTime = new Date();
    const controller = new AbortController();
    const abortTimeout = setTimeout(
      () => controller.abort(),
      LONGPOLL_TIMEOUT + 5000
    );
    const visibilityChange = () => {
      if (document.hidden) {
        controller.abort();
      }
    };
    window.addEventListener("visibilitychange", visibilityChange);

    const pollNext = (state: RemoteState) =>
      setTimeout(
        () => pollState(state),
        new Date().getTime() - startTime.getTime() < 1000 ? 1000 : 0
      );

    fetch(
      `/api/1/poll-state?state=${JSON.stringify(
        state
      )}&timeout=${LONGPOLL_TIMEOUT}`,
      {
        signal: controller.signal,
      }
    )
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.change) {
          setRemoteState(res.state as RemoteState);
        }
        pollNext(res.state || state);
      })
      .catch((_err) => {
        setPolling(false);
      })
      .finally(() => {
        clearTimeout(abortTimeout);
        window.removeEventListener("visibilitychange", visibilityChange);
      });
  };

  if (!polling) {
    pollState(remoteState);
    setPolling(true);
  }

  return [remoteState, setRemoteState];
}

function toggleOn(
  remoteState: RemoteState,
  setRemoteState: React.Dispatch<React.SetStateAction<RemoteState>>
) {
  setRemoteState({ ...remoteState, on: !remoteState.on });
  fetch("/api/1/toggle-on", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

function selectVisualization(
  visualization: number,
  remoteState: RemoteState,
  setRemoteState: React.Dispatch<React.SetStateAction<RemoteState>>
) {
  setRemoteState({ ...remoteState, visualization });
  fetch("/api/1/set-visualization", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visualization }),
  });
}

function ToggleSwitch({ isOn }: { isOn: boolean }) {
  return (
    <div className="toggle-switch">
      <div className={`toggle-slider ${isOn ? "on" : "off"}`}>
        <div className="toggle-knob"></div>
      </div>
    </div>
  );
}

function FullscreenButton({ onClick }: { onClick: (e: any) => void }) {
  return (
    <button
      className="fullscreen-button"
      onClick={onClick}
      aria-label="Fullscreen"
    >
      <div className="fullscreen-button-tl"></div>
      <div className="fullscreen-button-tr"></div>
      <div className="fullscreen-button-bl"></div>
      <div className="fullscreen-button-br"></div>
    </button>
  );
}

function VisualizationItem({
  viz,
  onClick,
  onToggleFullscreen,
  selected,
}: {
  viz: IVisualization;
  onClick: () => void;
  onToggleFullscreen: (viz: IVisualization) => void;
  selected: boolean;
}) {
  return (
    <div className="visualization-item" onClick={onClick}>
      <Visualization
        viz={viz}
        className={selected ? "selected" : ""}
        style={
          {
            viewTransitionName: `${viz.name}-viz-transition`,
          } as React.CSSProperties
        }
      />
      <div className="visualization-name">{viz.name}</div>
      <div
        className="fullscreen-button-container"
        style={
          {
            viewTransitionName: `${viz.name}-fullscreen-button-transition`,
          } as React.CSSProperties
        }
      >
        <FullscreenButton
          onClick={(e) => {
            e.stopPropagation();
            onToggleFullscreen?.(viz);
          }}
        />
      </div>
    </div>
  );
}

function VisualizationList() {
  const [state, setState] = useRemoteState();
  const visualizations = useVisualizations();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const prevColorRef = React.useRef<[number, number, number, number]>([
    0,
    0,
    0,
    0,
  ]);

  const [
    fullscreenViz,
    setFullscreenViz,
  ] = React.useState<IVisualization | null>(null);
  const [previousScrollY, setPreviousScrollY] = React.useState(0);

  const handleToggleOn = React.useCallback(() => toggleOn(state, setState), [
    state,
    setState,
  ]);

  React.useEffect(() => {
    if (!fullscreenViz) {
      container?.scrollTo(0, previousScrollY);
    }
  }, [previousScrollY, fullscreenViz]);

  const handleSelect = React.useCallback(
    (v: number) => selectVisualization(v, state, setState),
    [selectVisualization, state, setState]
  );

  const handleToggleFullscreen = React.useCallback(
    (viz: IVisualization | null) => {
      const doSelect = () => {
        setFullscreenViz(viz);
        if (viz) {
          setPreviousScrollY(container?.scrollTop || 0);
        }
      };
      if (document.startViewTransition) {
        document.startViewTransition(() => flushSync(() => doSelect()));
      } else {
        doSelect();
      }
    },
    [container, setFullscreenViz, setPreviousScrollY]
  );

  const handleUpdateAverageColor = (color: FastAverageColorResult) => {
    if (containerRef.current) {
      if (prevColorRef.current) {
        prevColorRef.current = [
          prevColorRef.current[0] * (1.0 - AVERAGE_COLOR_BLEND) +
            color.value[0] * AVERAGE_COLOR_BLEND,
          prevColorRef.current[1] * (1.0 - AVERAGE_COLOR_BLEND) +
            color.value[1] * AVERAGE_COLOR_BLEND,
          prevColorRef.current[2] * (1.0 - AVERAGE_COLOR_BLEND) +
            color.value[2] * AVERAGE_COLOR_BLEND,
          prevColorRef.current[3] * (1.0 - AVERAGE_COLOR_BLEND) +
            color.value[3] * AVERAGE_COLOR_BLEND,
        ];
        containerRef.current.style.setProperty(
          "background-color",
          `rgba(${prevColorRef.current[0]}, ${prevColorRef.current[1]}, ${prevColorRef.current[2]}, ${prevColorRef.current[3]})`
        );
      }
    }
  };

  if (fullscreenViz) {
    return (
      <div ref={containerRef} className="fullscreen-container">
        <div className="fullscreen-visualization">
          <Visualization
            viz={fullscreenViz}
            calculateAverageColor={true}
            onUpdateAverageColor={handleUpdateAverageColor}
            audio={true}
            style={
              {
                viewTransitionName: `${fullscreenViz.name}-viz-transition`,
              } as React.CSSProperties
            }
          />
          <div
            className="fullscreen-button-container"
            style={
              {
                viewTransitionName: `${fullscreenViz.name}-fullscreen-button-transition`,
              } as React.CSSProperties
            }
          >
            <FullscreenButton onClick={() => handleToggleFullscreen(null)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        className="toggle-button"
        onClick={handleToggleOn}
        aria-label="Toggle power"
      >
        <ToggleSwitch isOn={state.on} />
      </button>
      <div className="visualization-list">
        {visualizations.map((v, index) => (
          <VisualizationItem
            key={v.name}
            onClick={() => handleSelect(index)}
            onToggleFullscreen={handleToggleFullscreen}
            selected={index === state.visualization}
            viz={v}
          />
        ))}
      </div>
    </>
  );
}

function App() {
  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Pixelify Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #121212;
          color: #f5f5f5;
          overflow-x: hidden;
          image-rendering: pixelated;
        }
        
        #app-container {
          height: 100vh;
          width: 100vw;
          position: relative;
          margin: 0 auto;
          scroll-snap-type: y proximity;
          overflow-y: scroll;
        }
        
        .toggle-button {
          appearance: none;
          position: fixed;
          top: 8px;
          left: 8px;
          cursor: pointer;
          z-index: 100;
        }
        
        .toggle-switch {
          width: 96px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .toggle-slider {
          width: 96px;
          height: 48px;
          background-color: #121212;
          border: 4px solid #f5f5f5;
          position: relative;
          transition: all 0.2s ease;
        }
        
        .toggle-slider.on {
          background-color: #4CAF50;
        }
        
        .toggle-knob {
          position: absolute;
          left: 4px;
          top: 4px;
          width: 32px;
          height: 32px;
          background-color: #f5f5f5;
          transition: transform 0.2s ease;
        }
        
        .toggle-slider.on .toggle-knob {
          transform: translateX(48px);
        }
        
        .visualization-list {
          width: 100%;
          max-width: 860px;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
        }
        
        .visualization-item {
          width: 100%;
          scroll-snap-align: start;
          cursor: pointer;
          display: flex;
          position: relative;
          aspect-ratio: 2/1;
        }
        
        .visualization-name {
          position: absolute;
          bottom: 4px;
          left: 8px;
          font-family: 'Pixelify Sans', monospace;
          color: white;
          font-size: 24px;
          z-index: 10;
        }
        
        .visualization-canvas {
          width: 100%;
          height: auto;
          display: block;
          transition: all 0.1s ease;
          border: 0px solid #ffffff;
        }

        .fullscreen-visualization {
          width: 100%;
          height: 100%;
          max-width: calc(100vh * 2);
          max-height: calc(100vw / 2);
          aspect-ratio: 2/1;
          position: relative;
        }

        .visualization-canvas.selected {
          border: 4px solid #ffffff;
        }
        
        .fullscreen-button-container {
          position: absolute;
          bottom: 8px;
          right: 8px;
          transition: opacity 0.2s ease-in-out;
          z-index: 20;
          pointer-events: auto;
        }
        
        .fullscreen-button {
          background: rgba(0, 0, 0, 0.5);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          padding: 8px;
          cursor: pointer;
          position: relative;
        }

        .fullscreen-button-tl {
          position: absolute;
          top: 0;
          left: 0;
          width: 33%;
          height: 33%;
          border-top: 4px solid #ffffff;
          border-left: 4px solid #ffffff;
        }

        .fullscreen-button-tr {
          position: absolute;
          top: 0;
          right: 0;
          width: 33%;
          height: 33%;
          border-top: 4px solid #ffffff;
          border-right: 4px solid #ffffff;
        }

        .fullscreen-button-bl {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 33%;
          height: 33%;
          border-bottom: 4px solid #ffffff;
          border-left: 4px solid #ffffff;
        }

        .fullscreen-button-br {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 33%;
          height: 33%;
          border-bottom: 4px solid #ffffff;
          border-right: 4px solid #ffffff;
        }

        .fullscreen-container {
          width: 100vw;
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          background-color: #121212;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }

        .fullscreen-button:hover {
          background: rgba(0, 0, 0, 0.7);
        }
      `}</style>
      <VisualizationList />
    </>
  );
}

window.onerror = function (message, source, lineno, colno, error) {
  fetch(`/api/1/report-error`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      source,
      lineno,
      colno,
      stack: error?.stack,
    }),
  });
  return false;
};

const container = document.getElementById("app-container");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
