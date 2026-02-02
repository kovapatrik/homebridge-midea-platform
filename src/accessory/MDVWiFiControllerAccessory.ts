import type { CharacteristicValue, Service } from 'homebridge';
import type { DeviceAttributeBase } from '../core/MideaDevice';
import type MideaCCDevice from '../devices/cc/MideaCCDevice';
import type { MideaAccessory, MideaPlatform } from '../platform';
import type { DeviceConfig } from '../platformUtils';
import BaseAccessory, { limitValue } from './BaseAccessory';
import { Mode, FanSpeed } from '../devices/cc/MideaCCMessage';

export default class MDVWiFiControllerAccessory extends BaseAccessory<MideaCCDevice> {
  protected service: Service;

  private heatingThresholdTemperature: number;
  private coolingThresholdTemperature: number;

  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaCCDevice,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits).onGet(this.getTemperatureDisplayUnits.bind(this))
      .onSet(this.setTemperatureDisplayUnits.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState).onGet(this.getCurrentHeaterCoolerState.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getTargetHeaterCoolerState.bind(this))
      .onSet(this.setTargetHeaterCoolerState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this))
      .setProps({
        minValue: this.configDev.CC_options.minTemp,
        maxValue: this.configDev.CC_options.maxTemp,
        minStep: this.configDev.CC_options.tempStep,
      });

    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this))
      .setProps({
        minValue: this.configDev.CC_options.minTemp,
        maxValue: this.configDev.CC_options.maxTemp,
        minStep: this.configDev.CC_options.tempStep,
      });

    const fanSpeedSteps = this.configDev.CC_options.fanSpeedMode === '3'
      ? [33, 66, 100]  // 3-level: Low, Mid, High
      : [14, 28, 43, 57, 71, 86, 100];  // 7-level: Sleep, Micron, Low, Mid, High, SuperHigh, Power

    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this))
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: 1,
        validValues: fanSpeedSteps,
      });

    // Swing modes
    // this.service.getCharacteristic(this.platform.Characteristic.SwingMode).onGet(this.getSwingMode.bind(this)).onSet(this.setSwingMode.bind(this));

    // Misc

    this.heatingThresholdTemperature = accessory.context?.thresholds?.heatingTemperature ?? configDev.CC_options.minTemp;
    this.coolingThresholdTemperature = accessory.context?.thresholds?.coolingTemperature ?? configDev.CC_options.maxTemp;
  }

  protected async updateCharacteristics(attributes: DeviceAttributeBase) {
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      const updateState = false;
    }
  }

  getActive(): CharacteristicValue {
    return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    await this.device.set_attribute({ POWER: !!value });
  }

  getTemperatureDisplayUnits(): CharacteristicValue {
    return this.device.attributes.TEMP_FAHRENHEIT ? this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT : this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
  }

  async setTemperatureDisplayUnits(value: CharacteristicValue) {
    await this.device.set_attribute({ TEMP_FAHRENHEIT: value === this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT });
  }

  getCurrentHeaterCoolerState(): CharacteristicValue {
    if (!this.device.attributes.POWER || !this.device.attributes.MODE) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }

    const isPossiblyCooling = [Mode.Cool, Mode.Auto].includes(this.device.attributes.MODE);
    const isPossiblyHeating = [Mode.Heat, Mode.Auto].includes(this.device.attributes.MODE);

    const currentTemperature = Number(this.getCurrentTemperature());
    const heatingThresholdTemperature = Number(this.getHeatingThresholdTemperature());
    const coolingThresholdTemperature = Number(this.getCoolingThresholdTemperature());

    if (isPossiblyCooling && currentTemperature > coolingThresholdTemperature) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
    }

    if (isPossiblyHeating && currentTemperature < heatingThresholdTemperature) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
    }

    return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
  }

  getTargetHeaterCoolerState(): CharacteristicValue {
    switch (this.device.attributes.MODE) {
      case Mode.Cool:
        return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
      case Mode.Heat:
        return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
      default:
        return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        await this.device.set_attribute({ POWER: true, MODE: Mode.Auto });
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        await this.device.set_attribute({ POWER: true, MODE: Mode.Cool });
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        await this.device.set_attribute({ POWER: true, MODE: Mode.Heat });
        break;
    }

    await this.setTargetTemperatureWithinThresholds();
  }

  getCurrentTemperature(): CharacteristicValue {
    return this.device.attributes.INDOOR_TEMPERATURE ?? this.configDev.CC_options.minTemp;
  }

  getTargetTemperature(): CharacteristicValue {
    const { minTemp, maxTemp } = this.configDev.CC_options;
    return limitValue(this.device.attributes.TARGET_TEMPERATURE, minTemp, maxTemp);
  }

  async setTargetTemperature(value: CharacteristicValue) {
    const { minTemp, maxTemp, tempStep } = this.configDev.CC_options;
    const target = limitValue(Math.round(+value / tempStep) * tempStep, minTemp, maxTemp);

    if (this.getTargetTemperature() === target) return;
    await this.device.set_target_temperature(target);
  }

  async setTargetTemperatureWithinThresholds() {
    if (this.device.attributes.MODE === Mode.Cool) {
      await this.setTargetTemperature(this.getCoolingThresholdTemperature());
      return;
    }
    if (this.device.attributes.MODE === Mode.Heat) {
      await this.setTargetTemperature(this.getHeatingThresholdTemperature());
      return;
    }

    if (this.getCurrentTemperature() > this.getCoolingThresholdTemperature()) {
      await this.setTargetTemperature(this.getCoolingThresholdTemperature());
      return;
    }

    if (this.getCurrentTemperature() < this.getHeatingThresholdTemperature()) {
      await this.setTargetTemperature(this.getHeatingThresholdTemperature());
      return;
    }

    await this.setTargetTemperature(this.getCurrentTemperature());
  }

  getCoolingThresholdTemperature(): CharacteristicValue {
    const { minTemp, maxTemp } = this.configDev.CC_options;
    return limitValue(this.coolingThresholdTemperature, minTemp, maxTemp);
  }

  getHeatingThresholdTemperature(): CharacteristicValue {
    const { minTemp, maxTemp } = this.configDev.CC_options;
    return limitValue(this.heatingThresholdTemperature, minTemp, maxTemp);
  }

  getRotationSpeed(): CharacteristicValue {
    const fanSpeed = this.device.attributes.FAN_SPEED;
    if (!fanSpeed) return 0;

    return this.fanSpeedToPercentage(fanSpeed);
  }

  async setRotationSpeed(value: CharacteristicValue) {
    const percentage = Number(value);
    const fanSpeed = this.percentageToFanSpeed(percentage);
    await this.device.set_attribute({ FAN_SPEED: fanSpeed });
  }

  getSwingMode(): CharacteristicValue {
    // TODO: Implement swing mode getter
    return this.platform.Characteristic.SwingMode.SWING_DISABLED;
  }

  async setSwingMode(value: CharacteristicValue) {
    // TODO: Implement swing mode setter
  }

  private fanSpeedToPercentage(fanSpeed: FanSpeed): number {
    const mode = this.configDev.CC_options.fanSpeedMode;

    if (mode === '3') {
      // 3-level mode: Low, Mid, High
      switch (fanSpeed) {
        case FanSpeed.Low: return 33;
        case FanSpeed.Mid: return 66;
        case FanSpeed.High: return 100;
        default: return 66; // Default to Mid
      }
    } else {
      // 7-level mode: Sleep, Micron, Low, Mid, High, SuperHigh, Power
      switch (fanSpeed) {
        case FanSpeed.Sleep: return 14;
        case FanSpeed.Micron: return 28;
        case FanSpeed.Low: return 43;
        case FanSpeed.Mid: return 57;
        case FanSpeed.High: return 71;
        case FanSpeed.SuperHigh: return 86;
        case FanSpeed.Power: return 100;
        default: return 57; // Default to Mid
      }
    }
  }

  private percentageToFanSpeed(percentage: number): FanSpeed {
    const mode = this.configDev.CC_options.fanSpeedMode;

    if (mode === '3') {
      // 3-level mode: Low (33%), Mid (66%), High (100%)
      if (percentage <= 33) return FanSpeed.Low;
      if (percentage <= 66) return FanSpeed.Mid;
      return FanSpeed.High;
    } else {
      // 7-level mode: Sleep (14%), Micron (28%), Low (43%), Mid (57%), High (71%), SuperHigh (86%), Power (100%)
      if (percentage <= 14) return FanSpeed.Sleep;
      if (percentage <= 28) return FanSpeed.Micron;
      if (percentage <= 43) return FanSpeed.Low;
      if (percentage <= 57) return FanSpeed.Mid;
      if (percentage <= 71) return FanSpeed.High;
      if (percentage <= 86) return FanSpeed.SuperHigh;
      return FanSpeed.Power;
    }
  }

}
