import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { FastAverageColorResult } from "fast-average-color";
import { useVisualizations, Visualization } from "./visualizations.tsx";
import type { IVisualization } from "../shared/viz/visualization-type.ts";
import { useHash } from "./useHash.ts";

const AVERAGE_COLOR_BLEND = 0.5;

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    setIsMobile("ontouchstart" in window);
  }, []);

  return isMobile;
}

function useVizTransitionStyles(vizName: string | undefined) {
  React.useEffect(() => {
    if (!vizName) return;

    const styleId = `viz-transition-styles`;
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    const transitionName = `${vizName.toLowerCase()}-viz-transition`;
    styleElement.textContent = `
      :root::view-transition-new(${transitionName}) {
        animation: none;
      }
      :root::view-transition-old(${transitionName}) {
        animation: none;
      }
      :root::view-transition-group(${transitionName}) {
        animation: -ua-view-transition-group-anim-${transitionName} 0.2s;
      }
    `;
  }, [vizName]);
}

function FullscreenIcon({ visible }: { visible: boolean }) {
  return (
    <div className={`fullscreen-icon ${visible ? "visible" : "hidden"}`}>
      <div className="fullscreen-icon-tl"></div>
      <div className="fullscreen-icon-tr"></div>
      <div className="fullscreen-icon-bl"></div>
      <div className="fullscreen-icon-br"></div>
    </div>
  );
}

function CloseButton({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className={`close-icon ${visible ? "visible" : "hidden"}`}
      onClick={onClick}
      aria-label="Close fullscreen"
    ></button>
  );
}

function EnableAudioButton({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className={`enable-audio-icon ${visible ? "visible" : "hidden"}`}
      onClick={onClick}
      aria-label="Enable audio"
    ></button>
  );
}

function VisualizationItem({
  viz,
  onClick,
  isFullscreen = false,
}: {
  viz: IVisualization;
  onClick?: (v: IVisualization) => void;
  isFullscreen?: boolean;
}) {
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = React.useState(false);
  const [audio, setAudio] = React.useState(isFullscreen);
  const prevColorRef = React.useRef<[number, number, number, number]>([
    0,
    0,
    0,
    0,
  ]);

  const handleUpdateAverageColor = React.useCallback(
    (color: FastAverageColorResult) => {
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
        container?.style.setProperty(
          "background-color",
          `rgba(${prevColorRef.current[0]}, ${prevColorRef.current[1]}, ${prevColorRef.current[2]}, ${prevColorRef.current[3]})`
        );
      }
    },
    [container, prevColorRef]
  );

  const handleAudioNotPermitted = React.useCallback(() => {
    setAudio(false);
  }, []);

  React.useEffect(() => {
    if (isFullscreen) {
      container?.style.setProperty("overflow", "hidden");
      return () => {
        console.log("Cleanup");
        container?.style.removeProperty("background-color");
        container?.style.removeProperty("overflow");
      };
    }
  }, [isFullscreen]);

  const showFullscreenIcon = !isMobile && !isFullscreen && isHovered;
  const showEnableAudioButton = isFullscreen && !audio;

  return (
    <div
      className={
        isFullscreen ? "visualization-fullscreen" : "visualization-item"
      }
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      onClick={() => onClick?.(viz)}
    >
      <Visualization
        viz={viz}
        className="visualization-canvas"
        {...(isFullscreen
          ? {
              calculateAverageColor: true,
              onUpdateAverageColor: handleUpdateAverageColor,
              onAudioNotPermitted: handleAudioNotPermitted,
            }
          : {})}
        audio={audio}
        style={
          {
            viewTransitionName: `${viz.name.toLowerCase()}-viz-transition`,
          } as React.CSSProperties
        }
      />
      {!isFullscreen && (
        <div
          className="visualization-name"
          style={
            {
              viewTransitionName: `${viz.name.toLowerCase()}-viz-name-transition`,
            } as React.CSSProperties
          }
        >
          {viz.name}
        </div>
      )}
      <FullscreenIcon visible={showFullscreenIcon} />
      <EnableAudioButton
        visible={showEnableAudioButton}
        onClick={(e) => {
          e.stopPropagation();
          setAudio(true);
        }}
      />
    </div>
  );
}

function VisualizationList() {
  const visualizations = useVisualizations();
  const [hash, setHash] = useHash();
  const [selected, setSelected] = React.useState(
    visualizations.find((v) => v.name.toLowerCase() === hash.toLowerCase())
  );
  const [previousScrollY, setPreviousScrollY] = React.useState(0);
  const [showCloseButton, setShowCloseButton] = React.useState(true);
  const isMobile = useIsMobile();

  useVizTransitionStyles(selected?.name);

  React.useEffect(() => {
    if (isMobile || !selected) return;

    let timeout: NodeJS.Timeout;

    const resetTimeout = () => {
      setShowCloseButton(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowCloseButton(false), 2000);
    };

    const handleMouseMove = () => resetTimeout();

    resetTimeout();
    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isMobile, selected]);

  React.useEffect(() => {
    if (!selected) {
      container?.scrollTo(0, previousScrollY);
    }
  }, [previousScrollY, selected]);

  const handleSelect = React.useCallback(
    (viz: IVisualization | undefined) => {
      const doSelect = () => {
        setSelected(viz);
        setHash(viz?.name || "");
        if (viz) {
          setPreviousScrollY(container?.scrollTop || 0);
        }
      };
      if ((document as any).startViewTransition) {
        (document as any).startViewTransition(() => flushSync(() => doSelect()));
      } else {
        doSelect();
      }
    },
    [container, selected, setSelected, setPreviousScrollY]
  );

  if (selected) {
    return (
      <div
        className="fullscreen-container"
        onClick={() => handleSelect(undefined)}
      >
        <VisualizationItem viz={selected} isFullscreen={true} />
        <CloseButton
          visible={showCloseButton}
          onClick={(e) => {
            e.stopPropagation();
            handleSelect(undefined);
          }}
        />
      </div>
    );
  }

  return (
    <div className="visualization-list">
      {visualizations.map((v) => (
        <VisualizationItem key={v.name} viz={v} onClick={handleSelect} />
      ))}
    </div>
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
          transition: background-color 0.5s ease;
          view-transition-name: app-container-transition;
        }

        :root::view-transition(*) {
          animation-duration: 0.2s;
        }

        :root::view-transition-new(*):only-child {
          animation-delay: 0.2s;
          animation-duration: 0.1s;
        }

        :root::view-transition-group(app-container-transition) {
          animation-delay: 0;
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
          display: flex;
          position: relative;
          aspect-ratio: 2/1;
          cursor: pointer;
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
          border: 0px solid #ffffff;
        }

        .visualization-fullscreen {
          width: 100%;
          height: 100%;
          max-width: calc(100vh * 2);
          max-height: calc(100vw / 2);
          aspect-ratio: 2/1;
          position: absolute;
          cursor: pointer;
          z-index: 1;
        }

        .fullscreen-icon,.enable-audio-icon {
          background: rgba(0, 0, 0, 0.5);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          cursor: pointer;
          position: absolute;
          animation: fullscreen-icon-pulse 1.5s ease-in-out infinite;
          opacity: 0;
          bottom: 8px;
          right: 8px;
          transition: opacity 0.2s ease-in-out;
          z-index: 20;
        }

        .fullscreen-icon-tl {
          position: absolute;
          top: 0;
          left: 0;
          width: 33%;
          height: 33%;
          border-top: 4px solid #ffffff;
          border-left: 4px solid #ffffff;
        }

        .fullscreen-icon-tr {
          position: absolute;
          top: 0;
          right: 0;
          width: 33%;
          height: 33%;
          border-top: 4px solid #ffffff;
          border-right: 4px solid #ffffff;
        }

        .fullscreen-icon-bl {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 33%;
          height: 33%;
          border-bottom: 4px solid #ffffff;
          border-left: 4px solid #ffffff;
        }

        .fullscreen-icon-br {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 33%;
          height: 33%;
          border-bottom: 4px solid #ffffff;
          border-right: 4px solid #ffffff;
        }

        .fullscreen-icon:hover {
          background: rgba(0, 0, 0, 0.7);
        }

        @keyframes fullscreen-icon-pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }

        .fullscreen-container {
          width: 100vw;
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
        }

        .close-icon {
          appearance: none;
          background: rgba(0, 0, 0, 0.5);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          margin: 8px;
          display: flex;
          cursor: pointer;
          font-family: 'Pixelify Sans', monospace;
          font-size: 32px;
          font-weight: normal;
          position: absolute;
          top: 0;
          right: 0;
          z-index: 20;
          transition: opacity 0.2s ease-in-out;
        }

        .close-icon::before {
          content: 'x';
          display: block;
          width: 100%;
          height: 100%;
          line-height: 32px;
          text-align: center;
          margin: 0;
          padding: 0;
          transform: translateY(-2.5px);
        }

        .close-icon:hover {
          background: rgba(0, 0, 0, 0.7);
        }

        .visible {
          opacity: 1;
        }

        .hidden {
          opacity: 0;
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
