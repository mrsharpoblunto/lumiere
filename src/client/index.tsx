import React from "react";
import ReactDOM from "react-dom";
import { IAudioPlayer } from "../shared/audio-player-type.ts";
import { IVisualization } from "../shared/viz/visualization-type.ts";
import visualizations from "../shared/viz/index.ts";
import { CanvasMatrix } from "./canvas-matrix.ts";
import { BrowserAudio, NullAudio } from "./browser-audio.ts";
import { MATRIX_WIDTH, MATRIX_HEIGHT } from "../shared/config.ts";
import { FastAverageColor, FastAverageColorResult } from "fast-average-color";

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

function useVisualizations() {
  const [viz] = React.useState(() =>
    visualizations(MATRIX_WIDTH, MATRIX_HEIGHT)
  );
  return viz;
}

function useHash(): [string, (newHash: string) => void] {
  const [hash, setHash] = React.useState(() =>
    window.location.hash.replace("#", "")
  );

  React.useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash.replace("#", ""));
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const setter = React.useCallback((newHash: string) => {
    window.location.hash = newHash;
  }, []);

  return [hash, setter];
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

function Visualization(props: {
  viz: IVisualization;
  audio?: boolean;
  calculateAverageColor?: boolean;
  onUpdateAverageColor?: (color: FastAverageColorResult) => void;
  style?: React.CSSProperties;
  className?: string;
  [key: string]: any;
}) {
  const { viz, audio, ...rest } = props;

  const canvasRef = React.useRef(null);
  const audioRef = React.useRef(null);

  React.useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const fac = new FastAverageColor();

    const matrix = new CanvasMatrix(
      MATRIX_WIDTH,
      MATRIX_HEIGHT,
      canvasRef.current
    );
    const player: IAudioPlayer =
      audio && audioRef.current
        ? new BrowserAudio(audioRef.current)
        : new NullAudio();
    player.volume(viz.volume);
    if (viz.audio) {
      player.play(viz.audio);
    }

    let cleanup = false;
    let pending: number | null = null;

    matrix.afterSync((m, dt, t) => {
      if (!cleanup) {
        viz.run(m, player, dt, t);
        if (props.calculateAverageColor) {
          fac
            .getColorAsync(canvasRef.current, { algorithm: "dominant" })
            .then((color) => {
              props.onUpdateAverageColor?.(color);
            });
        }
        pending = window.requestAnimationFrame(() => {
          pending = null;
          m.sync();
        });
      }
    });
    matrix.sync();

    return () => {
      cleanup = true;
      if (player.cleanup) {
        player.cleanup();
      }
      if (pending) {
        window.cancelAnimationFrame(pending);
        pending = null;
      }
    };
  }, [audio, viz, canvasRef, audioRef]);

  return (
    <>
      <canvas
        {...rest}
        ref={canvasRef}
        width={MATRIX_WIDTH}
        height={MATRIX_HEIGHT}
        className={`visualization-canvas ${props.className || ""}`}
      />
      {audio && <audio ref={audioRef} />}
    </>
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
  const [_, setHash] = useHash();

  const handleFullscreenClick = (e: React.MouseEvent) => {
    setHash(viz.name);
    e.stopPropagation();
  };

  return (
    <div className="visualization-item" onClick={onClick}>
      <Visualization viz={viz} className={selected ? "selected" : ""} />
      <div className="visualization-name">{viz.name}</div>
      <div className="fullscreen-button-container">
        <FullscreenButton onClick={handleFullscreenClick} />
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

  const [hash, _] = useHash();

  const handleToggle = React.useCallback(() => toggleOn(state, setState), [
    state,
    setState,
  ]);
  const handleSelect = React.useCallback(
    (v: number) => selectVisualization(v, state, setState),
    [selectVisualization, state, setState]
  );
  const handleMinimize = React.useCallback(() => {
    window.history.back();
  }, []);

  const handleUpdateAverageColor = (color: FastAverageColorResult) => {
    if (containerRef.current) {
      console.log(color);
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

  if (hash) {
    const viz = visualizations.find(
      (v) => v.name.toLowerCase() === hash.toLowerCase()
    );
    if (viz) {
      return (
        <div ref={containerRef} className="fullscreen-container">
          <div className="fullscreen-visualization">
            <Visualization
              viz={viz}
              calculateAverageColor={true}
              onUpdateAverageColor={handleUpdateAverageColor}
              audio={true}
            />
            <div className="fullscreen-button-container">
              <FullscreenButton onClick={handleMinimize} />
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <>
      <button
        className="toggle-button"
        onClick={handleToggle}
        aria-label="Toggle power"
      >
        <ToggleSwitch isOn={state.on} />
      </button>
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

ReactDOM.render(<App />, document.getElementById("app-container"));
