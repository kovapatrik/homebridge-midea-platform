import type { CharacteristicValue, Service } from 'homebridge';
import type { DeviceAttributeBase } from '../core/MideaDevice';
import type MideaCCDevice from '../devices/cc/MideaCCDevice';
import type { MideaAccessory, MideaPlatform } from '../platform';
import type { DeviceConfig } from '../platformUtils';
import BaseAccessory from './BaseAccessory';

export default class MDVWiFiControllerAccessory extends BaseAccessory<MideaCCDevice> {
  protected service: Service;

  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaCCDevice,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    // this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));

    // this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits).onGet(this.getTemperatureDisplayUnits.bind(this));
    // // .onSet(this.setTemperatureDisplayUnits.bind(this));

    // this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState).onGet(this.getCurrentHeaterCoolerState.bind(this));

    // this.service
    //   .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
    //   .onGet(this.getTargetHeaterCoolerState.bind(this))
    //   .onSet(this.setTargetHeaterCoolerState.bind(this));

    // this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getCurrentTemperature.bind(this));

    // this.service
    //   .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
    //   .onGet(this.getTargetTemperature.bind(this))
    //   .onSet(this.setTargetTemperature.bind(this))
    //   .setProps({
    //     minValue: this.configDev.CC_options.minTemp,
    //     maxValue: this.configDev.CC_options.maxTemp,
    //     minStep: this.configDev.CC_options.tempStep,
    //   });

    // this.service
    //   .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
    //   .onGet(this.getTargetTemperature.bind(this))
    //   .onSet(this.setTargetTemperature.bind(this))
    //   .setProps({
    //     minValue: this.configDev.CC_options.minTemp,
    //     maxValue: this.configDev.CC_options.maxTemp,
    //     minStep: this.configDev.CC_options.tempStep,
    //   });

    // this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).onGet(this.getRotationSpeed.bind(this)).onSet(this.setRotationSpeed.bind(this));

    // // Swing modes
    // this.service.getCharacteristic(this.platform.Characteristic.SwingMode).onGet(this.getSwingMode.bind(this)).onSet(this.setSwingMode.bind(this));
  }

  protected async updateCharacteristics(attributes: DeviceAttributeBase) {
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      const updateState = false;
    }
  }

  // getActive(): CharacteristicValue {}
}
