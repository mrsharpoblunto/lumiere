import visualizations from "../shared/viz/index.ts";
import { MATRIX_WIDTH, MATRIX_HEIGHT } from "../shared/config.ts";
import { IVisualization } from "../shared/viz/visualization-type.ts";
import { Backbuffer } from "../shared/viz/back-buffer.ts";
import { IAudioPlayer } from "../shared/audio-player-type.ts";
import { CanvasOutput } from "./canvas-output.ts";
import { BrowserAudio, NullAudio } from "./browser-audio.ts";
import { BrowserLocationService } from "./browser-location-service.ts";
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
  onAudioNotPermitted?: () => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  const {
    viz,
    audio,
    calculateAverageColor,
    onUpdateAverageColor,
    className,
    onAudioNotPermitted,
    ...rest
  } = props;

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

    const backbuffer = new Backbuffer(MATRIX_WIDTH, MATRIX_HEIGHT);
    const output = new CanvasOutput(
      MATRIX_WIDTH,
      MATRIX_HEIGHT,
      canvasRef.current
    );
    const player: IAudioPlayer =
      audio && audioRef.current
        ? new BrowserAudio(audioRef.current, onAudioNotPermitted)
        : new NullAudio();
    const locationService = new BrowserLocationService();
    player.volume(viz.volume);
    if (viz.audio) {
      player.play(viz.audio);
    }

    let cleanup = false;
    let pending: number | null = null;
    let now = new Date().getTime();

    const render = () => {
      if (!cleanup) {
        const t = new Date().getTime();
        const dt = t - now;
        now = t;
        viz.run(backbuffer, player, locationService, dt, t);
        backbuffer.present(output);
        if (calculateAverageColor) {
          fac
            .getColorAsync(canvasRef.current, { algorithm: "dominant" })
            .then((color) => {
              onUpdateAverageColor?.(color);
            });
        }
        pending = window.requestAnimationFrame(render);
      }
    };
    pending = window.requestAnimationFrame(render);

    return () => {
      cleanup = true;
      if (player.cleanup) {
        player.cleanup();
      }
      if (pending) {
        window.cancelAnimationFrame(pending);
      }
    };
  }, [audio, viz, canvasRef, audioRef, onAudioNotPermitted, isIntersecting]);

  return (
    <>
      <canvas
        {...rest}
        ref={canvasRef}
        width={MATRIX_WIDTH}
        height={MATRIX_HEIGHT}
        className={`visualization-canvas ${className || ""}`}
      />
      {audio && <audio ref={audioRef} />}
    </>
  );
}
