# Lumiere
Control an LED matrix for an animated display on a Raspberry Pi. Also optionally provides accompanying audio & control over Philips Hue lights

![Freplace installation](/fireplace.gif)

## Hardware
- Adafruit LED matrix screen like [this](https://www.adafruit.com/product/420)
- Adafruit Raspberry PI Hat [Amazon](https://www.amazon.com/gp/product/B00SK69C6E/ref=ppx_yo_dt_b_asin_title_o00_s01?ie=UTF8&psc=1)
- DC adapter [Amazon](https://www.amazon.com/gp/product/B07CMM2BBR/ref=ppx_od_dt_b_asin_title_s00?ie=UTF8&psc=1)

## Software

- To install, run ```./scripts/setup.sh```
- Add to HomeKit by entering the pin in `HOMEKIT_PINCODE` in `src/server/config.mjs`
- Also control a Philips hue light group by updating `HUE_BRIDGE_IP`, `HUE_USER`, and `HUE_LIGHT_GROUP` in `src/server/config.mjs`
- Navigate to the webUI on https://<address_of_pi/

![Web UI](/screenshot.png)
