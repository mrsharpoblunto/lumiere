import React from "react";
import { createRoot } from "react-dom/client";
import { FastAverageColorResult } from "fast-average-color";
import { useVisualizations, Visualization } from "./visualizations.tsx";
import type { IVisualization } from "../shared/viz/visualization-type.ts";
import { useHash } from "./useHash.ts";

const AVERAGE_COLOR_BLEND = 0.1;

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

function VisualizationItem({ viz }: { viz: IVisualization }) {
  const [_, setHash] = useHash();

  const handleFullscreenClick = (e: React.MouseEvent) => {
    setHash(viz.name);
    e.stopPropagation();
  };

  return (
    <div className="visualization-item">
      <Visualization viz={viz} />
      <div className="visualization-name">{viz.name}</div>
      <div className="fullscreen-button-container">
        <FullscreenButton onClick={handleFullscreenClick} />
      </div>
    </div>
  );
}

function VisualizationList() {
  const visualizations = useVisualizations();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const prevColorRef = React.useRef<[number, number, number, number]>([
    0,
    0,
    0,
    0,
  ]);

  const [hash, _] = useHash();

  const handleMinimize = React.useCallback(() => {
    window.history.back();
  }, []);

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
      <div className="visualization-list">
        {visualizations.map((v) => (
          <VisualizationItem key={v.name} viz={v} />
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

const container = document.getElementById("app-container");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
