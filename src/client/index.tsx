import React from "react";
import { createRoot } from "react-dom/client";
import { IVisualization } from "../shared/viz/visualization-type.ts";
import { Visualization, useVisualizations } from "../www/visualizations.tsx";

const LONGPOLL_TIMEOUT = 30000;

type RemoteState = {
  on: boolean;
  visualization: number;
  volume: number;
};

function useRemoteState(): [
  RemoteState,
  React.Dispatch<React.SetStateAction<RemoteState>>
] {
  const [remoteState, setRemoteState] = React.useState<RemoteState>({
    on: false,
    visualization: -1,
    volume: 0.5,
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
        setTimeout(() => setPolling(false), 1000);
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

let pendingRequests = 0;
let pendingVolume = 0;

function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let queued: T | null = null;
  let queuedArgs: Parameters<T> | null = null;

  const throttleCall = (fn: T, args: Parameters<T>) => {
    queued = queuedArgs = null;
    fn(...args);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (queued && queuedArgs) {
        throttleCall(queued, queuedArgs);
      }
    }, delay);
  };

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      queued = func;
      queuedArgs = args;
    } else {
      throttleCall(func, args);
    }
  };
}

const setVolume = throttle((volume: number) => {
  fetch("/api/1/volume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ volume }),
  });
}, 500);

function ToggleSwitch({ isOn }: { isOn: boolean }) {
  return (
    <div className="toggle-switch">
      <div className={`toggle-slider ${isOn ? "on" : "off"}`}>
        <div className="toggle-knob"></div>
      </div>
    </div>
  );
}

function VolumeControl({
  volume,
  onChange,
}: {
  volume: number;
  onChange: (volume: number) => void;
}) {
  const [isDragging, setIsDragging] = React.useState(false);
  const volumeRef = React.useRef<HTMLDivElement>(null);

  const updateVolume = (e: PointerEvent | React.PointerEvent) => {
    if (!volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newVolume = Math.max(0, Math.min(1, x / rect.width));
    onChange(1 - newVolume);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateVolume(e);
    e.preventDefault();
  };

  React.useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDragging) {
        updateVolume(e);
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    }

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, updateVolume]);

  return (
    <div
      className="volume-control"
      ref={volumeRef}
      onPointerDown={handlePointerDown}
    >
      <div className="volume-triangle">
        <div
          className="volume-slider"
          style={{ left: `${(1 - volume) * 100}%` }}
        ></div>
        <div
          className="volume-fill"
          style={{ width: `${volume * 100}%` }}
        ></div>
      </div>
    </div>
  );
}

function VisualizationItem({
  viz,
  onClick,
  selected,
}: {
  viz: IVisualization;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <div className="visualization-item" onClick={onClick}>
      <Visualization viz={viz} className={selected ? "selected" : ""} />
      <div className="visualization-name">{viz.name}</div>
    </div>
  );
}

function VisualizationList() {
  const [state, setState] = useRemoteState();
  const visualizations = useVisualizations();
  const handleToggleOn = React.useCallback(() => toggleOn(state, setState), [
    state,
    setState,
  ]);

  const handleSelect = (v: number) => selectVisualization(v, state, setState);

  const handleVolumeChange = (newVolume: number) => {
    setState({ ...state, volume: newVolume });
    setVolume(newVolume);
  };

  return (
    <>
      <button
        className="toggle-button"
        onClick={handleToggleOn}
        aria-label="Toggle power"
      >
        <ToggleSwitch isOn={state.on} />
      </button>
      <div className="volume-button">
        <VolumeControl volume={state.volume} onChange={handleVolumeChange} />
      </div>
      <div className="visualization-list">
        {visualizations.map((v, index) => (
          <VisualizationItem
            key={v.name}
            onClick={() => handleSelect(index)}
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
        
        .volume-button {
          position: fixed;
          top: 8px;
          right: calc(8px + env(scrollbar-width, 15px));
          z-index: 100;
        }
        
        .volume-control {
          width: 104px;
          height: 48px;
          cursor: pointer;
          position: relative;
        }
        
        .volume-control::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 104px;
          height: 48px;
          background-color: #f5f5f5;
          clip-path: polygon(0% 0%, 100% 100%, 0% 100%);
          z-index: 0;
        }
        
        .volume-triangle {
          position: absolute;
          top: 7px;
          left: 4px;
          width: 83px;
          height: 37px;
          background-color: #121212;
          clip-path: polygon(0% 0%, 100% 100%, 0% 100%);
          overflow: hidden;
          z-index: 1;
        }
        
        .volume-fill {
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          background-color: #4CAF50;
          transition: width 0.1s ease;
          clip-path: polygon(0% 0%, 100% 100%, 0% 100%);
          z-index: 2;
        }
        
        .volume-slider {
          position: absolute;
          top: 0px;
          width: 8px;
          height: 56px;
          background-color: #f5f5f5;
          transform: translateX(-4px);
          transition: left 0.1s ease;
          z-index: 3;
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

        .visualization-canvas.selected {
          border: 4px solid #ffffff;
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
