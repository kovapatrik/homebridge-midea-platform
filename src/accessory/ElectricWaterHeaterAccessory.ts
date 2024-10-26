/***********************************************************************
 * Midea Platform Electric Water Heater Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import { CharacteristicValue, Service } from 'homebridge';
import MideaE2Device, { E2Attributes } from '../devices/e2/MideaE2Device';
import BaseAccessory from './BaseAccessory';
import { MideaAccessory, MideaPlatform } from '../platform';
import { DeviceConfig } from '../platformUtils';

export default class ElectricWaterHeaterAccessory extends BaseAccessory<MideaE2Device> {
  private service: Service;

  private variableHeatingService?: Service;
  private wholeTankHeatingService?: Service;

  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaE2Device,
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
        minValue: this.configDev.E2_options.minTemp,
        maxValue: this.configDev.E2_options.maxTemp,
        minStep: this.configDev.E2_options.tempStep,
      });

    this.variableHeatingService = this.accessory.getServiceById(this.platform.Service.Switch, 'VariableHeating');
    if (this.configDev.E2_options.variableHeatingSwitch) {
      this.variableHeatingService ??= this.accessory.addService(
        this.platform.Service.Switch,
        `${this.device.name} Variable Heating`,
        'VariableHeating',
      );
      this.variableHeatingService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Variable Heating`);
      this.variableHeatingService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Variable Heating`);
      this.variableHeatingService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getVariableHeating.bind(this))
        .onSet(this.setVariableHeating.bind(this));
    } else if (this.variableHeatingService) {
      this.accessory.removeService(this.variableHeatingService);
    }

    this.wholeTankHeatingService = this.accessory.getServiceById(this.platform.Service.Switch, 'WholeTankHeating');
    if (this.configDev.E2_options.wholeTankHeatingSwitch) {
      this.wholeTankHeatingService ??= this.accessory.addService(
        this.platform.Service.Switch,
        `${this.device.name} Whole Tank Heating`,
        'WholeTankHeating',
      );
      this.wholeTankHeatingService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Whole Tank Heating`);
      this.wholeTankHeatingService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Whole Tank Heating`);
      this.wholeTankHeatingService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getWholeTankHeating.bind(this))
        .onSet(this.setWholeTankHeating.bind(this));
    } else if (this.wholeTankHeatingService) {
      this.accessory.removeService(this.wholeTankHeatingService);
    }
  }

  /*********************************************************************
   * Callback function called by MideaDevice whenever there is a change to
   * any attribute value.
   */
  protected async updateCharacteristics(attributes: Partial<E2Attributes>) {
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
      case 'heating':
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentHeaterCoolerState,
          v ? this.platform.Characteristic.CurrentHeaterCoolerState.HEATING : this.platform.Characteristic.CurrentHeaterCoolerState.IDLE,
        );
        updateState = true;
        break;
        // case 'keep_warm':
        //   this.platform.log.debug(`[${this.device.name}] Keep warm: ${v}`);
        //   break;
        // case 'protection':
        //   this.platform.log.debug(`[${this.device.name}] Protection: ${v}`);
        //   break;
      case 'current_temperature':
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, v as CharacteristicValue);
        updateState = true;
        break;
      case 'target_temperature':
        this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, v as CharacteristicValue);
        updateState = true;
        break;
      case 'whole_tank_heating':
        this.wholeTankHeatingService?.updateCharacteristic(this.platform.Characteristic.On, v as CharacteristicValue);
        break;
      case 'variable_heating':
        this.variableHeatingService?.updateCharacteristic(this.platform.Characteristic.On, v as CharacteristicValue);
        break;
        // case 'heating_time_remaining':
        //   this.platform.log.debug(`[${this.device.name}] Heating time remaining: ${v}`);
        //   break;
        // case 'water_consumption':
        //   this.platform.log.debug(`[${this.device.name}] Water consumption: ${v}`);
        //   break;
        // case 'heating_power':
        //   this.platform.log.debug(`[${this.device.name}] Heating power: ${v}`);
        //   break;
      default:
        this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
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
    return this.device.attributes.CURRENT_TEMPERATURE ?? this.configDev.E2_options.minTemp;
  }

  getTargetTemperature(): CharacteristicValue {
    return Math.max(
      this.configDev.E2_options.minTemp,
      Math.min(this.configDev.E2_options.maxTemp, this.device.attributes.TARGET_TEMPERATURE),
    );
  }

  async setTargetTemperature(value: CharacteristicValue) {
    value = Math.max(this.configDev.E2_options.minTemp, Math.min(this.configDev.E2_options.maxTemp, value as number));
    await this.device.set_attribute({ TARGET_TEMPERATURE: value });
  }

  getVariableHeating(): CharacteristicValue {
    return this.device.attributes.VARIABLE_HEATING;
  }

  async setVariableHeating(value: CharacteristicValue) {
    await this.device.set_attribute({ VARIABLE_HEATING: !!value });
  }

  getWholeTankHeating(): CharacteristicValue {
    return this.device.attributes.WHOLE_TANK_HEATING;
  }

  async setWholeTankHeating(value: CharacteristicValue) {
    await this.device.set_attribute({ WHOLE_TANK_HEATING: !!value });
  }
}
