import type { Application, Request, Response } from "express";
import * as winston from "winston";
import storage from "node-persist";
import * as config from "./config.ts";
import { VizController } from "./viz-controller.ts";

declare global {
  namespace Express {
    interface Locals {
      vizController: VizController;
      storage: typeof storage;
      logger: winston.Logger;
    }
  }
}

type VizEvent = {
  state: any;
};

export function configureApiRoutes(app: Application): void {
  function waitForVizEvent(
    timeout: number,
    callback: (timedOut: boolean, event: VizEvent | null) => void
  ): void {
    let listener: ((state: VizEvent) => void) | null = null;
    let timeoutHandle = setTimeout(() => {
      if (listener) {
        app.locals?.vizController.removeListener("change", listener);
      }
      callback(true, null);
    }, timeout);

    listener = (state: VizEvent) => {
      if (listener) {
        app.locals?.vizController.removeListener("change", listener);
      }
      clearTimeout(timeoutHandle);
      callback(false, state);
    };

    app.locals?.vizController.addListener("change", listener);
  }

  app.get("/api/1/poll-state", (req: Request, res: Response) => {
    const queryState = JSON.parse(req.query.state as string);

    if (
      req.app.locals.vizController &&
      JSON.stringify(queryState) !==
        JSON.stringify(req.app.locals.vizController.getState())
    ) {
      res.json({
        success: true,
        change: true,
        state: req.app.locals.vizController.getState(),
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
    req.app.locals?.logger.error(
      `Client error: ${req.body.source}:${req.body.lineno}:${req.body.colno} - ${req.body.message}\n${req.body.stack}`
    );
    res.status(200).end();
  });

  app.post("/api/1/toggle-on", async (req: Request, res: Response) => {
    try {
      if (!req.app.locals.vizController || !req.app.locals.storage) {
        throw new Error("VizController or storage not initialized");
      }

      const { on } = req.app.locals.vizController.toggleOn(config.WEB_USER);
      await req.app.locals.storage.setItem(
        config.VIZ_KEY,
        JSON.stringify(req.app.locals.vizController.getState())
      );
      req.app.locals.logger?.info("Set on state to " + on);
      res.json({
        success: true,
        on,
      });
    } catch (err: any) {
      req.app.locals.logger?.error(err.stack);
      res.status(500).json({
        success: false,
      });
    }
  });

  app.post("/api/1/set-visualization", async (req: Request, res: Response) => {
    try {
      if (!req.app.locals.vizController || !req.app.locals.storage) {
        throw new Error("VizController or storage not initialized");
      }

      const { visualization } = req.app.locals.vizController.setVisualization(
        parseInt(req.body.visualization, 10),
        config.WEB_USER
      );
      await req.app.locals.storage.setItem(
        config.VIZ_KEY,
        JSON.stringify(req.app.locals.vizController.getState())
      );
      req.app.locals.logger?.info("Set viz to " + visualization);
      res.json({
        success: true,
        visualization,
      });
    } catch (err: any) {
      req.app.locals.logger?.error(err.stack);
      res.status(500).json({
        success: false,
      });
    }
  });
}
