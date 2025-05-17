import * as hap from "hap-nodejs";
import * as config from "./config.ts";
import { VizController } from "./viz-controller.ts";

export default function (vizController: VizController): hap.Accessory {
  const accessoryUUID = hap.uuid.generate("hap-nodejs:accessories:fyreplace");

  const light = new hap.Accessory("Fyreplace", accessoryUUID);

  light
    .getService(hap.Service.AccessoryInformation)!
    .setCharacteristic(hap.Characteristic.Manufacturer, config.MANUFACTURER)
    .setCharacteristic(hap.Characteristic.Model, config.MODEL)
    .setCharacteristic(hap.Characteristic.SerialNumber, config.SERIAL);

  light.on("identify", function (_paired: boolean, cb: () => void) {
    vizController.identify();
    cb();
  });

  light
    .addService(hap.Service.Lightbulb, "Lumiere")
    .getCharacteristic(hap.Characteristic.On)
    .on(
      "set",
      function (value: hap.CharacteristicValue, cb: (error?: Error) => void) {
        try {
          vizController.setOn(!!value, config.HOMEKIT_USER);
          cb();
        } catch (err: any) {
          cb(err);
        }
      }
    )
    .on("get", function (cb: (error: Error | null, value?: boolean) => void) {
      cb(null, vizController.getState().on);
    });

  vizController.on(
    "change",
    function ({ state, source }: { state: any; source: string }) {
      if (source !== config.HOMEKIT_USER) {
        light
          .getService(hap.Service.Lightbulb)!
          .getCharacteristic(hap.Characteristic.On)
          .updateValue(state.on);
      }
    }
  );

  return light;
}
