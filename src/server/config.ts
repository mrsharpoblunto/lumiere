import { fileURLToPath } from "url";
import path from "path";
import type { Response } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const LOG_LEVEL =
  process.env.NODE_ENV === "production" ? "info" : "verbose";
export const APP_HTTPS = process.env.NODE_ENV === "production";
export const APP_SERVER_PORT =
  process.env.NODE_ENV === "production" ? (APP_HTTPS ? 443 : 80) : 3000;
export const MAX_AGE = "31536000";
export const LONGPOLL_TIMEOUT = 30000;
export const PUBLIC_STATIC_CACHING =
  process.env.NODE_ENV === "development"
    ? {}
    : {
        maxAge: MAX_AGE,
        setHeaders: (res: Response, path: string) => {
          if (path === "/" || path.indexOf(".html") > 0) {
            res.setHeader("Cache-Control", "no-cache");
          } else {
            res.setHeader("Cache-Control", `public, max-age=${MAX_AGE}`);
          }
        },
      };
export const HOMEKIT_PORT = 51826;
export const HOMEKIT_USERNAME = "1A:2B:3C:4D:5F:FF";
export const HOMEKIT_PINCODE = "031-45-155";
export const MANUFACTURER = "Glenn Conner";
export const MODEL = "Rev 1";
export const SERIAL = "0001";
export const VIZ_KEY = "viz_state";
export const WEB_USER = "web user";
export const HOMEKIT_USER = "HomeKit user";

export const VOLUME_COMMAND = "amixer set Master";
export const AUDIO_COMMAND = "mpg123";
export const AUDIO_ARGS = ["-q"];

export const LATITUDE = 37.563;
export const LONGITUDE = -122.3255;

export const SSL_KEY = path.join(__dirname, "../../ssl/server.key");
export const SSL_CERT = path.join(__dirname, "../../ssl/server.crt");
