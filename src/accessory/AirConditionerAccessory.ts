import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { MideaPlatform } from '../platform';
import BaseAccessory from './BaseAccessory';

export default class AirConditionerAccessory extends BaseAccessory {

  constructor(
    platform: MideaPlatform,
    accessory: PlatformAccessory,
  ) {
    super(platform, accessory);

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) ||
                   this.accessory.addService(this.platform.Service.HeaterCooler);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentHeaterCoolerState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getTargetHeaterCoolerState.bind(this))
      .onSet(this.setTargetHeaterCoolerState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));
  }

  async getActive(): Promise<CharacteristicValue> {
    return this.accessory.context.device.attributes['POWER'] ?
      this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    await this.accessory.context.device.set_attribute({ POWER: value === this.platform.Characteristic.Active.ACTIVE ? 1 : 0 });
  }

  getCurrentHeaterCoolerState(): CharacteristicValue {
    if (this.accessory.context.device.attributes['POWER'] && this.accessory.context.device.attributes['MODE'] > 0) {
      if (this.accessory.context.device.attributes['TARGET_TEMPERATURE'] < this.accessory.context.device.attributes['INDOOR_TEMPERATURE']) {
        if ([1, 2].includes(this.accessory.context.device.attributes['MODE'])) {
          return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        } else {
          return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }
      } else if (this.accessory.context.device.attributes['TARGET_TEMPERATURE'] ===
                 this.accessory.context.device.attributes['INDOOR_TEMPERATURE']) {
        return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
      } else {
        if (this.accessory.context.device.attributes['MODE'] === 4) {
          return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        } else {
          return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }
      }
    } else {
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }
  }

  getTargetHeaterCoolerState(): CharacteristicValue {
    if (this.accessory.context.device.attributes['MODE'] === 2) {
      return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
    } else if (this.accessory.context.device.attributes['MODE'] === 4) {
      return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
    } else {
      return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        await this.accessory.context.device.set_attribute({ MODE: 1 });
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        await this.accessory.context.device.set_attribute({ MODE: 2 });
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        await this.accessory.context.device.set_attribute({ MODE: 4 });
        break;
    }
  }

  getCurrentTemperature(): CharacteristicValue {
    return this.accessory.context.device.attributes['INDOOR_TEMPERATURE'];
  }
}
