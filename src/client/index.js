/**
 * @format
 */
import React from 'react';
import ReactDOM from 'react-dom';
import visualizations from '../shared/viz/index.mjs';
import {CanvasMatrix} from './canvas-matrix';
import {MATRIX_WIDTH, MATRIX_HEIGHT} from '../shared/config.mjs';
import {patchMatrix} from '../shared/viz/helpers.mjs';

import {
  makeStyles,
  ThemeProvider,
  createMuiTheme,
} from '@material-ui/core/styles';
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
} from '@material-ui/core';
import FireplaceIcon from '@material-ui/icons/Fireplace';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
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
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: 'flex-end',
  },
}));

const LONGPOLL_TIMEOUT = 30000;

function useRemoteState() {
  const [remoteState, setRemoteState] = React.useState({
    on: false,
    visualization: -1,
  });
  const [polling, setPolling] = React.useState(false);

  const pollState = state => {
    const startTime = new Date();
    const controller = new AbortController();
    const abortTimeout = setTimeout(
      () => controller.abort(),
      LONGPOLL_TIMEOUT + 5000,
    );
    const visibilityChange = () => {
      if (document.hidden) {
        controller.abort();
      }
    };
    window.addEventListener('visibilitychange', visibilityChange);

    const pollNext = state =>
      setTimeout(
        () => pollState(state),
        new Date().getTime() - startTime < 1000 ? 1000 : 0,
      );

    fetch(
      `/api/1/poll-state?state=${JSON.stringify(
        state,
      )}&timeout=${LONGPOLL_TIMEOUT}`,
      {
        signal: controller.signal,
      },
    )
      .then(res => res.json())
      .then(res => {
        if (res.success && res.change) {
          setRemoteState(res.state);
        }
        pollNext(res.state || state);
      })
      .catch(err => {
        setPolling(false);
      })
      .finally(() => {
        clearTimeout(abortTimeout);
        window.removeEventListener('visibilitychange', visibilityChange);
      });
  };

  if (!polling) {
    pollState(remoteState);
    setPolling(true);
  }

  return [remoteState, setRemoteState];
}

function useVisualizations() {
  const [viz] = React.useState(visualizations(MATRIX_WIDTH, MATRIX_HEIGHT));
  return viz;
}

function toggleOn(remoteState, setRemoteState) {
  setRemoteState({...remoteState, on: !remoteState.on});
  fetch('/api/1/toggle-on', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({}),
  });
}

function selectVisualization(visualization, remoteState, setRemoteState) {
  setRemoteState({...remoteState, visualization});
  fetch('/api/1/set-visualization', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({visualization}),
  });
}

function VisualizationItem({viz, onClick, selected}) {
  return (
    <ListItem onClick={onClick} selected={selected} button>
      <ListItemText primary={viz.name} />
      <Visualization viz={viz} />
    </ListItem>
  );
}

function Visualization(props) {
  const canvasEl = React.useRef(null);
  React.useEffect(() => {
    const matrix = patchMatrix(
      new CanvasMatrix(MATRIX_WIDTH, MATRIX_HEIGHT, canvasEl.current),
    );

    let cleanup = false;
    let pending = null;

    matrix.afterSync((m, dt, t) => {
      if (!cleanup) {
        props.viz.run(m, dt, t);
        pending = window.requestAnimationFrame(() => {
          pending = null;
          m.sync();
        });
      }
    });
    matrix.sync();

    return () => {
      cleanup = true;
      if (pending) {
        window.clearAnimationFrame(pending);
        pending = null;
      }
    };
  }, [props.viz, canvasEl]);

  return (
    <canvas
      {...props}
      ref={canvasEl}
      width={MATRIX_WIDTH}
      height={MATRIX_HEIGHT}
    />
  );
}

function App() {
  const classes = useStyles();
  const visualizations = useVisualizations();
  const [state, setState] = useRemoteState();

  const handleToggle = () => toggleOn(state, setState);
  const handleSelect = v => selectVisualization(v, state, setState);

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = React.useMemo(
    () =>
      createMuiTheme({
        palette: {
          type: prefersDarkMode ? 'dark' : 'light',
        },
      }),
    [prefersDarkMode],
  );

  if (window.location.hash) {
    const index = parseInt(window.location.hash.substr(1), 10);
    return (
      <Visualization
        viz={visualizations[index]}
        style={{width: '100%', height: '100%'}}
      />
    );
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
              className={classes.toggleSwitch}
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
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({message, source, lineno, colno, stack: error.stack}),
  });
  return false;
};

ReactDOM.render(<App />, document.getElementById('app-container'));
ReactDOM.render(<App />, document.getElementById('app-container'));
