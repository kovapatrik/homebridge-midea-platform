/***********************************************************************
 * Midea Heat Pump Water Heater Accessory class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type { CDAttributes } from '../devices/cd/MideaCDDevice.js';
import type MideaCDDevice from '../devices/cd/MideaCDDevice.js';
import { Mode } from '../devices/cd/MideaCDMessage.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory, { limitValue } from './BaseAccessory.js';

const energySaveModeSubtype = 'energySaveMode';
const standardModeSubtype = 'standardMode';
const compatibilizingModeSubtype = 'compatibilizingMode';
const smartModeSubtype = 'smartMode';
const disinfectionSubtype = 'disinfection';

export default class HeatPumpWaterHeaterAccessory extends BaseAccessory<MideaCDDevice> {
  protected service: Service;

  private energySaveModeService: Service;
  private standardModeService: Service;
  private compatibilizingModeService: Service;
  private smartModeService: Service;

  private disinfectionService?: Service;

  /*********************************************************************
   * Constructor registers all the service types with Homebridge, registers
   * a callback function with the MideaDevice class, and requests device status.
   */
  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaCDDevice,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState).onGet(this.getCurrentHeaterCoolerState.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getTargetHeaterCoolerState.bind(this))
      .onSet(this.setTargetHeaterCoolerState.bind(this))
      .setProps({
        validValues: [this.platform.Characteristic.TargetHeaterCoolerState.HEAT],
      });

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this))
      .setProps({
        minValue: this.configDev.CD_options.minTemp,
        maxValue: this.configDev.CD_options.maxTemp,
        minStep: this.configDev.CD_options.tempStep,
      });

    // Mode switches
    this.energySaveModeService =
      this.accessory.getServiceById(this.platform.Service.Switch, energySaveModeSubtype) ||
      this.accessory.addService(this.platform.Service.Switch, energySaveModeSubtype);
    this.handleConfiguredName(this.energySaveModeService, energySaveModeSubtype, `${this.device.name} Energy Save Mode`);
    this.energySaveModeService
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getMode.bind(this, Mode.EnergySave))
      .onSet(this.setMode.bind(this, Mode.EnergySave));

    this.standardModeService =
      this.accessory.getServiceById(this.platform.Service.Switch, standardModeSubtype) ||
      this.accessory.addService(this.platform.Service.Switch, standardModeSubtype);
    this.handleConfiguredName(this.standardModeService, standardModeSubtype, `${this.device.name} Standard Mode`);
    this.standardModeService
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getMode.bind(this, Mode.Standard))
      .onSet(this.setMode.bind(this, Mode.Standard));

    this.compatibilizingModeService =
      this.accessory.getServiceById(this.platform.Service.Switch, compatibilizingModeSubtype) ||
      this.accessory.addService(this.platform.Service.Switch, compatibilizingModeSubtype);
    this.handleConfiguredName(this.compatibilizingModeService, compatibilizingModeSubtype, `${this.device.name} Compatibilizing Mode`);
    this.compatibilizingModeService
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getMode.bind(this, Mode.Compatibilizing))
      .onSet(this.setMode.bind(this, Mode.Compatibilizing));

    this.smartModeService =
      this.accessory.getServiceById(this.platform.Service.Switch, smartModeSubtype) ||
      this.accessory.addService(this.platform.Service.Switch, smartModeSubtype);
    this.handleConfiguredName(this.smartModeService, smartModeSubtype, `${this.device.name} Smart Mode`);
    this.smartModeService
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getMode.bind(this, Mode.Smart))
      .onSet(this.setMode.bind(this, Mode.Smart));

    // Disinfection Service
    this.disinfectionService = this.accessory.getServiceById(this.platform.Service.Switch, disinfectionSubtype);
    if (this.configDev.CD_options.disinfectionSwitch) {
      this.disinfectionService ??= this.accessory.addService(this.platform.Service.Switch, undefined, disinfectionSubtype);
      this.handleConfiguredName(this.disinfectionService, 'Disinfection', `${this.device.name} Disinfection`);
      this.disinfectionService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getDisinfection.bind(this)).onSet(this.setDisinfection.bind(this));
    } else if (this.disinfectionService) {
      this.accessory.removeService(this.disinfectionService);
    }
  }

  async updateCharacteristics(attributes: Partial<CDAttributes>) {
    // const updateState = false;
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      switch (k) {
        default:
          this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
          break;
      }
    }
    // if (updateState) {
    // this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
    // this.service.updateCharacteristic(this.platform.Characteristic.InUse, this.getInUse());
    // this.service.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.getRemainingDuration());
    // }
  }

  getActive(): CharacteristicValue {
    return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    await this.device.set_attribute({ POWER: value === this.platform.Characteristic.Active.ACTIVE });
  }

  getCurrentHeaterCoolerState(): CharacteristicValue {
    return this.device.attributes.POWER && (this.device.attributes.CURRENT_TEMPERATURE ?? 0) < this.device.attributes.TARGET_TEMPERATURE
      ? this.platform.Characteristic.CurrentHeaterCoolerState.HEATING
      : this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
  }

  getTargetHeaterCoolerState(): CharacteristicValue {
    return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    await this.device.set_attribute({ POWER: value === this.platform.Characteristic.TargetHeaterCoolerState.HEAT });
  }

  getCurrentTemperature(): CharacteristicValue {
    return this.device.attributes.CURRENT_TEMPERATURE ?? 0;
  }

  getTargetTemperature(): CharacteristicValue {
    return limitValue(this.device.attributes.TARGET_TEMPERATURE, this.configDev.CD_options.minTemp, this.configDev.CD_options.maxTemp);
  }

  async setTargetTemperature(value: CharacteristicValue) {
    await this.device.set_attribute({
      POWER: true,
      TARGET_TEMPERATURE: limitValue(value as number, this.configDev.CD_options.minTemp, this.configDev.CD_options.maxTemp),
    });
  }

  getMode(mode: Mode): CharacteristicValue {
    return this.device.attributes.MODE === mode;
  }

  async setMode(mode: Mode) {
    await this.device.set_attribute({ POWER: true, MODE: mode });
  }

  getDisinfection(): CharacteristicValue {
    return this.device.attributes.STERILIZE === true;
  }

  async setDisinfection(value: CharacteristicValue) {
    await this.device.set_sterilize(value as boolean);
  }
}
