import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { MideaPlatform } from '../platform';
import BaseAccessory from './BaseAccessory';

enum SwingMode {
  NONE = 'None',
  VERTICAL = 'Vertical',
  HORIZONTAL = 'Horizontal',
  BOTH = 'Both',
}

export default class AirConditionerAccessory extends BaseAccessory {

  private config: {
    ip: string;
    name: string;
    deviceType: string;
    ACoptions: {
      swingMode: SwingMode;
      minTemp: number;
      maxTemp: number;
      tempStep: number;
      fahrenHeit: boolean;
      fanOnlyMode: boolean;
      outDoorTemp: boolean;
      audioFeedback: boolean;
    };
  };

  private outDoorTemperatureService?: Service;
  private displayService?: Service;

  constructor(
    platform: MideaPlatform,
    accessory: PlatformAccessory,
  ) {
    super(platform, accessory);

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) ||
                   this.accessory.addService(this.platform.Service.HeaterCooler);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.device.name);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.config = this.platform.config.devices.find((dev: any) => dev.ip === this.accessory.context.device.ip);

    if (this.config.ACoptions.outDoorTemp) {
      this.outDoorTemperatureService = this.accessory.getService(this.platform.Service.TemperatureSensor) ||
                                     this.accessory.addService(this.platform.Service.TemperatureSensor);

      this.outDoorTemperatureService.setCharacteristic(this.platform.Characteristic.Name, `${this.accessory.context.device.name} Outdoor`);

      this.outDoorTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getOutdoorTemperature.bind(this));
    }

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

    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this))
      .setProps({
        minValue: this.config.ACoptions.minTemp,
        maxValue: this.config.ACoptions.maxTemp,
        minStep: this.config.ACoptions.tempStep,
      });

    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this))
      .setProps({
        minValue: this.config.ACoptions.minTemp,
        maxValue: this.config.ACoptions.maxTemp,
        minStep: this.config.ACoptions.tempStep,
      });

    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this))
      .setProps({
        minValue: 0,
        maxValue: 102,
        minStep: 1,
      });

    if (this.config.ACoptions.swingMode !== SwingMode.NONE) {
      this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
        .onGet(this.getSwingMode.bind(this))
        .onSet(this.setSwingMode.bind(this));
    }

    // this.displayService = this.accessory.getService(this.platform.Service.Switch) ||
    //                       this.accessory.addService(this.platform.Service.Switch);
    // this.displayService.setCharacteristic(this.platform.Characteristic.Name, `${this.accessory.context.device.name} Display`);
    // this.displayService.getCharacteristic(this.platform.Characteristic.On)
    //   .onGet(this.getDisplayActive.bind(this))
    //   .onSet(this.setDisplayActive.bind(this));

    this.accessory.context.device.attributes['PROMPT_TONE'] = this.config.ACoptions.audioFeedback;
    this.accessory.context.device.attributes['TEMP_FAHRENHEIT'] = this.config.ACoptions.fahrenHeit;

    // if (this.config.ACoptions.fanOnlyMode) {

    // }
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

  getTargetTemperature(): CharacteristicValue {
    return Math.max(this.config.ACoptions.minTemp,
      Math.min(this.config.ACoptions.maxTemp, this.accessory.context.device.attributes['TARGET_TEMPERATURE']));
  }

  async setTargetTemperature(value: CharacteristicValue) {
    value = Math.max(this.config.ACoptions.minTemp,
      Math.min(this.config.ACoptions.maxTemp, value as number));
    await this.accessory.context.device.set_target_temperature(value);
  }

  getSwingMode(): CharacteristicValue {
    return this.accessory.context.device.attributes['SWING_HORIZONTAL'] || this.accessory.context.device.attributes['SWING_VERTICAL'] ?
      this.platform.Characteristic.SwingMode.SWING_ENABLED : this.platform.Characteristic.SwingMode.SWING_DISABLED;
  }

  async setSwingMode(value: CharacteristicValue) {
    switch (value) {
      case this.platform.Characteristic.SwingMode.SWING_ENABLED:
        await this.accessory.context.device.set_swing(
          [SwingMode.HORIZONTAL, SwingMode.BOTH].includes(this.config.ACoptions.swingMode),
          [SwingMode.VERTICAL, SwingMode.BOTH].includes(this.config.ACoptions.swingMode));
        break;
      case this.platform.Characteristic.SwingMode.SWING_DISABLED:
        await this.accessory.context.device.set_swing(false, false);
        break;
    }
  }

  getRotationSpeed(): CharacteristicValue {
    return this.accessory.context.device.attributes['FAN_SPEED'];
  }

  async setRotationSpeed(value: CharacteristicValue) {
    value = value as number;
    if (value === 101) {
      value = 102;
    }
    await this.accessory.context.device.set_attribute({ FAN_SPEED: value });
  }

  getOutdoorTemperature(): CharacteristicValue {
    return this.accessory.context.device.attributes['OUTDOOR_TEMPERATURE'];
  }

  getDisplayActive(): CharacteristicValue {
    return this.accessory.context.device.attributes['SCREEN_DISPLAY'];
  }

  async setDisplayActive(value: CharacteristicValue) {
    await this.accessory.context.device.set_attribute({ SCREEN_DISPLAY: value });
  }
}
