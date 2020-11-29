/*
 * @format
 */
import * as config from './config.mjs';

export function configureApiRoutes(app) {
  function waitForVizEvent(timeout, callback) {
    let listener = null;
    let timeoutHandle = setTimeout(() => {
      app.vizController.removeListener('change', listener);
      callback(true, null);
    }, timeout);
    listener = state => {
      app.vizController.removeListener('change', listener);
      clearTimeout(timeoutHandle);
      callback(false, state);
    };
    app.vizController.addListener('change', listener);
  }

  app.get('/api/1/poll-state', (req, res) => {
    const queryState = JSON.parse(req.query.state);

    if (
      JSON.stringify(queryState) !==
      JSON.stringify(app.vizController.getState())
    ) {
      return res.json({
        success: true,
        change: true,
        state: app.vizController.getState(),
      });
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/json',
      });
      res.write(''); // flush headers to the client
      waitForVizEvent(
        req.query.timeout < 60000 ? req.query.timeout : 60000,
        (timedOut, event) => {
          res.write(
            JSON.stringify({
              success: true,
              change: timedOut
                ? false
                : JSON.stringify(queryState) !== JSON.stringify(event.state),
              state: timedOut ? null : event.state,
            }),
          );
          res.end();
        },
      );
    }
  });

  app.post('/api/1/toggle-on', async (req, res) => {
    try {
      const {on} = app.vizController.toggleOn(config.WEB_USER);
      app.logger.info('Set on state to ' + on);
      res.json({
        success: true,
        on,
      });
    } catch (err) {
      app.logger.error(err.stack);
      res.status(500).json({
        success: false,
      });
    }
  });

  app.get('/api/1/list-visualizations', async (req, res) => {
    try {
      res.json({
        success: true,
        visualizations: app.vizController.visualizations.map((v, index) => {
          return {index, name: v.name};
        }),
      });
    } catch (err) {
      app.logger.error(err.stack);
      res.status(500).json({
        success: false,
      });
    }
  });

  app.post('/api/1/set-visualization', async (req, res) => {
    try {
      const {visualization} = await app.vizController.setVisualization(
        parseInt(req.body.visualization, 10),
        config.WEB_USER,
      );
      await app.storage.setItem(config.VIZ_KEY, visualization);
      app.logger.info(
        'Set viz to ' + app.vizController.visualizations[visualization].name,
      );
      res.json({
        success: true,
        visualization,
      });
    } catch (err) {
      app.logger.error(err.stack);
      res.status(500).json({
        success: false,
      });
    }
  });
}
