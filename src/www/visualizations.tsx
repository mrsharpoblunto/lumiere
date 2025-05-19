import visualizations from "../shared/viz/index.ts";
import { MATRIX_WIDTH, MATRIX_HEIGHT } from "../shared/config.ts";
import { IVisualization } from "../shared/viz/visualization-type.ts";
import { IAudioPlayer } from "../shared/audio-player-type.ts";
import { CanvasMatrix } from "./canvas-matrix.ts";
import { BrowserAudio, NullAudio } from "./browser-audio.ts";
import { FastAverageColor, FastAverageColorResult } from "fast-average-color";
import React from "react";

export function useVisualizations() {
  const [viz] = React.useState(() =>
    visualizations(MATRIX_WIDTH, MATRIX_HEIGHT)
  );
  return viz;
}

export function Visualization(props: {
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
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  React.useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    // Set up intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsIntersecting(entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(canvasRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [canvasRef]);

  React.useEffect(() => {
    if (!canvasRef.current || !isIntersecting) {
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
  }, [audio, viz, canvasRef, audioRef, isIntersecting]);

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
