import { CharacteristicValue, Service } from 'homebridge';
import { MideaAccessory, MideaPlatform } from '../platform';
import BaseAccessory from './BaseAccessory';
import { DeviceConfig, SwingMode } from '../platformUtils';
import MideaACDevice from '../devices/ac/MideaACDevice';
import { PLATFORM_NAME, PLUGIN_NAME } from '../settings';

export default class AirConditionerAccessory extends BaseAccessory<MideaACDevice> {

  private service: Service;
  private outDoorTemperatureService?: Service;
  private displayService?: Service;
  private fanService?: Service;
  private accessories: MideaAccessory[];

  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaACDevice,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) ||
                   this.accessory.addService(this.platform.Service.HeaterCooler);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.accessories = this.platform.accessories.filter(acc => acc.context.id === this.accessory.UUID && acc !== this.accessory);

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
        minValue: this.configDev.AC_options!.minTemp,
        maxValue: this.configDev.AC_options!.maxTemp,
        minStep: this.configDev.AC_options!.tempStep,
      });

    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this))
      .setProps({
        minValue: this.configDev.AC_options!.minTemp,
        maxValue: this.configDev.AC_options!.maxTemp,
        minStep: this.configDev.AC_options!.tempStep,
      });

    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this))
      .setProps({
        minValue: 0,
        maxValue: 102,
        minStep: 1,
      });

    // Swing modes
    if (this.configDev.AC_options!.swingMode !== SwingMode.NONE) {
      this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
        .onGet(this.getSwingMode.bind(this))
        .onSet(this.setSwingMode.bind(this));
    }

    // Outdoor temperature sensor
    if (this.configDev.AC_options!.outDoorTemp) {
      const outDoorTemperatureAccessory = this.getOrCreateSubAccessory('Outdoor');
      this.outDoorTemperatureService = outDoorTemperatureAccessory.getService(this.platform.Service.TemperatureSensor) ||
                                       outDoorTemperatureAccessory.addService(this.platform.Service.TemperatureSensor);

      this.outDoorTemperatureService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Outdoor`);

      this.outDoorTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getOutdoorTemperature.bind(this));

      this.outDoorTemperatureService.getCharacteristic(this.platform.Characteristic.StatusFault)
        .onGet(() => this.device.attributes.OUTDOOR_TEMPERATURE === undefined ?
          this.platform.Characteristic.StatusFault.GENERAL_FAULT :
          this.platform.Characteristic.StatusFault.NO_FAULT);
    }

    // Display
    if (this.configDev.AC_options!.switchDisplay.flag) {
      this.device.set_alternate_switch_display(this.configDev.AC_options!.switchDisplay.command);
      const displayAccessory = this.getOrCreateSubAccessory('Display');
      this.displayService = displayAccessory.getService(this.platform.Service.Switch) ||
                            displayAccessory.addService(this.platform.Service.Switch);
      this.displayService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Display`);
      this.displayService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getDisplayActive.bind(this))
        .onSet(this.setDisplayActive.bind(this));
    }

    // Misc
    this.device.attributes.PROMPT_TONE = this.configDev.AC_options!.audioFeedback;
    this.device.attributes.TEMP_FAHRENHEIT = this.configDev.AC_options!.fahrenHeit;


    // Remove unused accessories
    this.platform.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.accessories);
  }

  async getActive(): Promise<CharacteristicValue> {
    return this.device.attributes.POWER ?
      this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    await this.device.set_attribute({ POWER: value as boolean });
    this.device.attributes.SCREEN_DISPLAY = value as boolean;
    this.displayService?.updateCharacteristic(this.platform.Characteristic.On, value as boolean);
  }

  getCurrentHeaterCoolerState(): CharacteristicValue {
    if (this.device.attributes.POWER && this.device.attributes.MODE > 0) {
      if (this.device.attributes.TARGET_TEMPERATURE < (this.device.attributes.INDOOR_TEMPERATURE ?? 0 ) ) {
        if ([1, 2].includes(this.device.attributes.MODE)) {
          return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        } else {
          return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }
      } else if (this.device.attributes.TARGET_TEMPERATURE === this.device.attributes.INDOOR_TEMPERATURE) {
        return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
      } else {
        if (this.device.attributes.MODE === 4) {
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
    if (this.device.attributes.MODE === 2) {
      return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
    } else if (this.device.attributes.MODE === 4) {
      return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
    } else {
      return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        await this.device.set_attribute({ MODE: 1 });
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        await this.device.set_attribute({ MODE: 2 });
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        await this.device.set_attribute({ MODE: 4 });
        break;
    }
  }

  getCurrentTemperature(): CharacteristicValue {
    return this.device.attributes.INDOOR_TEMPERATURE ?? this.configDev.AC_options!.minTemp;
  }

  getTargetTemperature(): CharacteristicValue {
    return Math.max(this.configDev.AC_options!.minTemp,
      Math.min(this.configDev.AC_options!.maxTemp, this.device.attributes.TARGET_TEMPERATURE));
  }

  async setTargetTemperature(value: CharacteristicValue) {
    value = Math.max(this.configDev.AC_options!.minTemp,
      Math.min(this.configDev.AC_options!.maxTemp, value as number));
    await this.device.set_target_temperature(value);
  }

  getSwingMode(): CharacteristicValue {
    return this.device.attributes.SWING_HORIZONTAL || this.device.attributes.SWING_VERTICAL ?
      this.platform.Characteristic.SwingMode.SWING_ENABLED : this.platform.Characteristic.SwingMode.SWING_DISABLED;
  }

  async setSwingMode(value: CharacteristicValue) {
    switch (value) {
      case this.platform.Characteristic.SwingMode.SWING_ENABLED:
        await this.device.set_swing(
          [SwingMode.HORIZONTAL, SwingMode.BOTH].includes(this.configDev.AC_options!.swingMode),
          [SwingMode.VERTICAL, SwingMode.BOTH].includes(this.configDev.AC_options!.swingMode));
        break;
      case this.platform.Characteristic.SwingMode.SWING_DISABLED:
        await this.device.set_swing(false, false);
        break;
    }
  }

  getRotationSpeed(): CharacteristicValue {
    return this.device.attributes.FAN_SPEED;
  }

  async setRotationSpeed(value: CharacteristicValue) {
    value = value as number;
    if (value === 101) {
      value = 102;
    }
    await this.device.set_attribute({ FAN_SPEED: value });
  }

  getOutdoorTemperature(): CharacteristicValue {
    return this.device.attributes.OUTDOOR_TEMPERATURE ?? -270;
  }

  getDisplayActive(): CharacteristicValue {
    return this.device.attributes.SCREEN_DISPLAY;
  }

  async setDisplayActive(value: CharacteristicValue) {
    if (this.device.attributes.POWER) {
      await this.device.set_attribute({ SCREEN_DISPLAY: value as boolean });
    }
  }

  getOrCreateSubAccessory(type: string): MideaAccessory {
    let accessory: MideaAccessory;
    if (this.configDev.singleAccessory) {
      accessory = this.accessory;
    } else {
      const tempFind = this.accessories.findIndex(acc => acc.context.type === type);
      if (tempFind !== -1) {
        accessory = this.accessories[tempFind];
        this.accessories.splice(tempFind, 1);
      } else {
        accessory = new this.platform.api.platformAccessory(`${this.device.name} ${type}`,
          this.platform.api.hap.uuid.generate(`${this.device.id}:${type}`));
        accessory.context.type = type;
        accessory.context.id = this.accessory.UUID;

        this.platform.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
      accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Midea')
        .setCharacteristic(this.platform.Characteristic.Model, this.device.model)
        .setCharacteristic(this.platform.Characteristic.SerialNumber, this.device.sn);
    }
    return accessory;
  }
}
