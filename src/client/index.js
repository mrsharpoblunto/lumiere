/**
 * @format
 */
import React from 'react';
import ReactDOM from 'react-dom';

import {
  makeStyles,
  ThemeProvider,
  createMuiTheme,
} from '@material-ui/core/styles';
import {
  Switch,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
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

  const pollState = state => {
    const startTime = new Date();
    const controller = new AbortController();
    const abortTimeout = setTimeout(
      () => controller.abort(),
      LONGPOLL_TIMEOUT + 5000,
    );
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
      .finally(() => {
        clearTimeout(abortTimeout);
      });
  };

  const [polling, setPolling] = React.useState(false);
  if (!polling) {
    pollState(remoteState);
    setPolling(true);
  }

  return [remoteState, setRemoteState];
}

function useVisualizations() {
  const [viz, setViz] = React.useState(null);
  if (!viz) {
    fetch('/api/1/list-visualizations')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setViz(res.visualizations);
        }
      });
  }
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
          {visualizations ? (
            <List aria-label="visualizations">
              {visualizations.map((v, index) => (
                <ListItem
                  onClick={() => handleSelect(index)}
                  selected={index === state.visualization}
                  key={v.name}
                  button>
                  <ListItemText primary={v.name} />
                </ListItem>
              ))}
            </List>
          ) : (
            <CircularProgress />
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

ReactDOM.render(<App />, document.getElementById('app-container'));
