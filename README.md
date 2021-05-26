# Lumiere
Control an LED matrix for an animated display on a Raspberry Pi. Also optionally provides accompanying audio & control over Philips Hue lights

![Freplace installation](/fireplace.gif)

## Installing

Run ```./scripts/setup.sh```

## Usage

- Add to HomeKit by entering the pin in `HOMEKIT_PINCODE` in `src/server/config.mjs`
- Also control a Philips hue light group by updating `HUE_BRIDGE_IP`, `HUE_USER`, and `HUE_LIGHT_GROUP` in `src/server/config.mjs`
- Navigate to the webUI on https://<address_of_pi/

![Web UI](/screenshot.png)
