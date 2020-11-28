/**
 * @format
 */
import React from 'react';
import ReactDOM from 'react-dom';
//import * as clientConfig from './client-config';
import {
  Container,
  Switch,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@material-ui/core';

/**
function useRemoteState() {
  const [remoteState, setRemoteState] = React.useState({});

  const controller = new AbortController();
  const abortTimeout = setTimeout(
    () => controller.abort(),
    clientConfig.LONGPOLL_TIMEOUT + 5000,
  );
  const pollNext = () => {
    setTimeout(
      () => 
    
}
*/

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

function App() {
  const visualizations = useVisualizations();

  return (
    <Container>
      <Switch />
      <Divider />
      {visualizations ? (
        <List aria-label="visualizations">
          {visualizations.map(v => (
            <ListItem button>
              <ListItemText primary={v.name} />
            </ListItem>
          ))}
        </List>
      ) : (
        <CircularProgress />
      )}
    </Container>
  );
}

ReactDOM.render(<App />, document.getElementById('app-container'));
