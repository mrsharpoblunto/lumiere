import React from "react";
import ReactDOM from "react-dom";
import { IAudioPlayer } from "../shared/audio-player-type.ts";
import { IVisualization } from "../shared/viz/visualization-type.ts";
import visualizations from "../shared/viz/index.ts";
import { CanvasMatrix } from "./canvas-matrix.ts";
import { BrowserAudio, NullAudio } from "./browser-audio.ts";
import { MATRIX_WIDTH, MATRIX_HEIGHT } from "../shared/config.ts";

import {
  makeStyles,
  ThemeProvider,
  createMuiTheme,
} from "@material-ui/core/styles";
import {
  Switch,
  List,
  ListItem,
  ListItemText,
  CssBaseline,
  Toolbar,
  AppBar,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import FireplaceIcon from "@material-ui/icons/Fireplace";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing(3),
  },
  menuIcon: {
    marginRight: theme.spacing(2),
  },
  header: {
    flexGrow: 1,
  },
  drawerHeader: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: "flex-end",
  },
}));

const LONGPOLL_TIMEOUT = 30000;

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

function useHash() {
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

  return hash;
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
    <ListItem onClick={onClick} selected={selected} button>
      <ListItemText primary={viz.name} />
      <Visualization viz={viz} />
    </ListItem>
  );
}

function Visualization(props: {
  viz: IVisualization;
  audio?: boolean;
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

  const setHash = () => {
    window.location.hash = props.viz.name;
  };

  return (
    <>
      <canvas
        {...rest}
        ref={canvasRef}
        onClick={process.env.NODE_ENV !== "production" ? setHash : undefined}
        width={MATRIX_WIDTH}
        height={MATRIX_HEIGHT}
      />
      {audio && <audio ref={audioRef} />}
    </>
  );
}

function App() {
  const classes = useStyles();
  const visualizations = useVisualizations();
  const [state, setState] = useRemoteState();

  const handleToggle = () => toggleOn(state, setState);
  const handleSelect = (v: number) => selectVisualization(v, state, setState);

  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = React.useMemo(
    () =>
      createMuiTheme({
        palette: {
          type: prefersDarkMode ? "dark" : "light",
        },
      }),
    [prefersDarkMode]
  );

  const hash = useHash();
  if (hash) {
    const viz = visualizations.find((v) => v.name === hash);
    if (viz) {
      return (
        <Visualization
          viz={viz}
          audio={true}
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "calc(100vh * 2)",
            maxHeight: "calc(100vw / 2)",
            aspectRatio: "2/1",
          }}
        />
      );
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <div className={classes.root}>
        <CssBaseline />
        <AppBar position="fixed">
          <Toolbar>
            <FireplaceIcon className={classes.menuIcon} />
            <Typography className={classes.header} variant="h6" noWrap>
              Lumiere
            </Typography>
            <Switch
              aria-label="toggle on"
              checked={state.on}
              onChange={handleToggle}
            />
          </Toolbar>
        </AppBar>
        <main className={classes.content}>
          <div className={classes.drawerHeader} />
          <List aria-label="visualizations">
            {visualizations.map((v, index) => (
              <VisualizationItem
                key={v.name}
                onClick={() => handleSelect(index)}
                selected={index === state.visualization}
                viz={v}
              />
            ))}
          </List>
        </main>
      </div>
    </ThemeProvider>
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
