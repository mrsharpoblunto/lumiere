/*
 * @format
 */
import { Express, Request, Response } from "express";
import * as winston from "winston";
import storage from "node-persist";
import * as config from "./config.js";
import { VizController } from "./viz-controller.js";

type AppWithExtensions = Express & {
  logger?: winston.Logger;
  storage?: typeof storage;
  vizController?: VizController;
};

type VizEvent = {
  state: any;
};

export function configureApiRoutes(app: AppWithExtensions): void {
  function waitForVizEvent(
    timeout: number,
    callback: (timedOut: boolean, event: VizEvent | null) => void
  ): void {
    let listener: ((state: VizEvent) => void) | null = null;
    let timeoutHandle = setTimeout(() => {
      if (listener && app.vizController) {
        app.vizController.removeListener("change", listener);
      }
      callback(true, null);
    }, timeout);
    
    listener = (state: VizEvent) => {
      if (app.vizController && listener) {
        app.vizController.removeListener("change", listener);
      }
      clearTimeout(timeoutHandle);
      callback(false, state);
    };
    
    if (app.vizController) {
      app.vizController.addListener("change", listener);
    }
  }

  app.get("/api/1/poll-state", (req: Request, res: Response) => {
    const queryState = JSON.parse(req.query.state as string);

    if (
      app.vizController &&
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
        "Content-Type": "application/json",
      });
      res.write(""); // flush headers to the client
      waitForVizEvent(
        parseInt(req.query.timeout as string, 10) < 60000 
          ? parseInt(req.query.timeout as string, 10) 
          : 60000,
        (timedOut, event) => {
          res.write(
            JSON.stringify({
              success: true,
              change: timedOut
                ? false
                : JSON.stringify(queryState) !== JSON.stringify(event?.state),
              state: timedOut ? null : event?.state,
            })
          );
          res.end();
        }
      );
    }
  });

  app.post("/api/1/report-error", (req: Request, res: Response) => {
    app.logger?.error(
      `Client error: ${req.body.source}:${req.body.lineno}:${req.body.colno} - ${req.body.message}\n${req.body.stack}`
    );
    res.status(200).end();
  });

  app.post("/api/1/toggle-on", async (req: Request, res: Response) => {
    try {
      if (!app.vizController || !app.storage) {
        throw new Error("VizController or storage not initialized");
      }
      
      const { on } = app.vizController.toggleOn(config.WEB_USER);
      await app.storage.setItem(
        config.VIZ_KEY,
        JSON.stringify(app.vizController.getState())
      );
      app.logger?.info("Set on state to " + on);
      res.json({
        success: true,
        on,
      });
    } catch (err: any) {
      app.logger?.error(err.stack);
      res.status(500).json({
        success: false,
      });
    }
  });

  app.post("/api/1/set-visualization", async (req: Request, res: Response) => {
    try {
      if (!app.vizController || !app.storage) {
        throw new Error("VizController or storage not initialized");
      }
      
      const { visualization } = await app.vizController.setVisualization(
        parseInt(req.body.visualization, 10),
        config.WEB_USER
      );
      await app.storage.setItem(
        config.VIZ_KEY,
        JSON.stringify(app.vizController.getState())
      );
      app.logger?.info(
        "Set viz to " + app.vizController.visualizations[visualization].name
      );
      res.json({
        success: true,
        visualization,
      });
    } catch (err: any) {
      app.logger?.error(err.stack);
      res.status(500).json({
        success: false,
      });
    }
  });
}