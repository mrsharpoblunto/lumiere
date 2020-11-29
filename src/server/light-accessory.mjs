/**
 * @format
 */
import * as hap from 'hap-nodejs';
import * as config from './config.mjs';

export default function (vizController) {
  const accessoryUUID = hap.uuid.generate('hap-nodejs:accessories:fyreplace');

  const light = new hap.Accessory('Fyreplace', accessoryUUID);

  light
    .getService(hap.Service.AccessoryInformation)
    .setCharacteristic(hap.Characteristic.Manufacturer, config.MANUFACTURER)
    .setCharacteristic(hap.Characteristic.Model, config.MODEL)
    .setCharacteristic(hap.Characteristic.SerialNumber, config.SERIAL);

  light.on(hap.AccessoryEventTypes.IDENTIFY, function (paired, cb) {
    vizController.identify();
    cb();
  });

  light
    .addService(hap.Service.Lightbulb, 'Lumiere')
    .getCharacteristic(hap.Characteristic.On)
    .on(hap.CharacteristicEventTypes.SET, function (value, cb) {
      try {
        vizController.setOn(!!value, config.HOMEKIT_USER);
        cb();
      } catch (err) {
        cb(err);
      }
    })
    .on(hap.CharacteristicEventTypes.GET, function (cb) {
      cb(vizController.getState().on);
    });

  vizController.on('change', function ({state, source}) {
    if (source !== config.HOMEKIT_USER) {
      light
        .getService(hap.Service.Lightbulb)
        .getCharacteristic(hap.Characteristic.On)
        .updateValue(state.on);
    }
  });

  return light;
}
