/**
 * @format
 */
export const LOG_LEVEL =
  process.env.NODE_ENV === 'production' ? 'info' : 'verbose';
export const APP_HTTPS = process.env.NODE_ENV === 'production';
export const APP_SERVER_PORT =
  process.env.NODE_ENV === 'production' ? (APP_HTTPS ? 443 : 80) : 3000;
export const MAX_AGE = '31536000';
export const LONGPOLL_TIMEOUT = 30000;
export const PUBLIC_STATIC_CACHING =
  process.env.NODE_ENV === 'development'
    ? {}
    : {
        maxAge: MAX_AGE,
        setHeaders: (res, path) => {
          if (path === '/' || path.indexOf('.html') > 0) {
            res.setHeader('Cache-Control', 'no-cache');
          } else {
            res.setHeader('Cache-Control', `public, max-age=${MAX_AGE}`);
          }
        },
      };
export const HOMEKIT_PORT = 51826;
export const HOMEKIT_USERNAME = '1A:2B:3C:4D:5F:FF';
export const HOMEKIT_PINCODE = '031-45-155';
export const MANUFACTURER = 'Glenn Conner';
export const MODEL = 'Rev 1';
export const SERIAL = '0001';
export const VIZ_KEY = 'viz_state';
export const WEB_USER = 'web user';
export const HOMEKIT_USER = 'HomeKit user';

export const AUDIO_COMMAND = 'omxplayer';
export const AUDIO_ARGS = ['-o', 'alsa:hw:1,0', '--loop'];

export const HUE_BRIDGE_IP = '192.168.0.4';
export const HUE_USER = 'O7nK3Cv1WUSGeOtiuzWbPCsxbjxCdIwmRFWPo72Z';
export const HUE_LIGHT_GROUP = 13;

// TODO matrix properties should go here too...
