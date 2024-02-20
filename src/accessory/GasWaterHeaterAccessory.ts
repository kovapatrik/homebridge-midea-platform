/***********************************************************************
 * Midea Platform Gas Water Heater Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import { CharacteristicValue, Service } from 'homebridge';
import MideaE3Device, { E3Attributes } from '../devices/e3/MideaE3Device';
import BaseAccessory from './BaseAccessory';
import { MideaAccessory, MideaPlatform } from '../platform';
import { DeviceConfig } from '../platformUtils';

export default class GasWaterHeaterAccessory extends BaseAccessory<MideaE3Device> {
  private service: Service;

  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaE3Device,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service =
      this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentHeaterCoolerState.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getTargetHeaterCoolerState.bind(this))
      .onSet(this.setTargetHeaterCoolerState.bind(this))
      .setProps({
        validValues: [
          this.platform.Characteristic.TargetHeatingCoolingState.OFF,
          this.platform.Characteristic.TargetHeaterCoolerState.HEAT,
        ],
      });

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this))
      .setProps({
        minValue: this.configDev.E3_options.minTemp,
        maxValue: this.configDev.E3_options.maxTemp,
        minStep: this.configDev.E3_options.tempStep,
      });

    this.device.on('update', this.updateCharacteristics.bind(this));
    this.device.refresh_status();
  }

  /*********************************************************************
   * Callback function called by MideaDevice whenever there is a change to
   * any attribute value.
   */
  private async updateCharacteristics(attributes: Partial<E3Attributes>) {
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      let updateState = false;
      switch (k.toLowerCase()) {
        case 'power':
          this.service.updateCharacteristic(
            this.platform.Characteristic.Active,
            v ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE,
          );
          updateState = true;
          break;
        // case 'burning_state':
        //   break;
        // case 'zero_cold_water':
        //   break;
        // case 'protection':
        //   this.platform.log.debug(`[${this.device.name}] Protection: ${v}`);
        //   break;
        // case 'zero_cold_pulse':
        //   break;
        // case 'smart_volume':
        //   break;
        case 'current_temperature':
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, v as CharacteristicValue);
          updateState = true;
          break;
        case 'target_temperature':
          this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, v as CharacteristicValue);
          updateState = true;
          break;
        default:
          this.platform.log.warn(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
      }
      if (updateState) {
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.getTargetHeaterCoolerState());
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentHeaterCoolerState());
      }
    }
  }

  /*********************************************************************
   * Callback functions for each Homebridge/HomeKit service
   *
   */
  getActive(): CharacteristicValue {
    return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    await this.device.set_attribute({ POWER: !!value });
  }

  getCurrentHeaterCoolerState(): CharacteristicValue {
    if (this.device.attributes.POWER) {
      return this.device.attributes.HEATING
        ? this.platform.Characteristic.CurrentHeaterCoolerState.HEATING
        : this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
    }
    return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
  }

  getTargetHeaterCoolerState(): CharacteristicValue {
    return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    if (value === this.platform.Characteristic.TargetHeaterCoolerState.HEAT) {
      await this.device.set_attribute({ POWER: true });
    } else {
      await this.device.set_attribute({ POWER: false });
    }
  }

  getCurrentTemperature(): CharacteristicValue {
    return this.device.attributes.CURRENT_TEMPERATURE ?? this.configDev.E3_options.minTemp;
  }

  getTargetTemperature(): CharacteristicValue {
    return Math.max(
      this.configDev.E3_options.minTemp,
      Math.min(this.configDev.E3_options.maxTemp, this.device.attributes.TARGET_TEMPERATURE),
    );
  }

  async setTargetTemperature(value: CharacteristicValue) {
    value = Math.max(this.configDev.E3_options.minTemp, Math.min(this.configDev.E3_options.maxTemp, value as number));
    await this.device.set_attribute({ TARGET_TEMPERATURE: value });
  }
}
