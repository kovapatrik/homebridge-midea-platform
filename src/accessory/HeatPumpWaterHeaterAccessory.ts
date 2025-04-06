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
const eHeaterSubtype = 'eHeater';
const smartModeSubtype = 'smartMode';
const disinfectionSubtype = 'disinfection';

export default class HeatPumpWaterHeaterAccessory extends BaseAccessory<MideaCDDevice> {
  protected service: Service;

  private energySaveModeService?: Service;
  private standardModeService?: Service;
  private eHeaterService?: Service;
  private smartModeService?: Service;

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

    // Enery-save Mode switch
    this.energySaveModeService = this.accessory.getServiceById(this.platform.Service.Switch, energySaveModeSubtype);
    if (this.configDev.CD_options.energySaveModeSwitch) {
      this.energySaveModeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, energySaveModeSubtype);
      this.handleConfiguredName(this.energySaveModeService, energySaveModeSubtype, 'Energy Save Mode');
      this.energySaveModeService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(() => this.getMode(Mode.EnergySave))
        .onSet((value) => this.setMode(value, Mode.EnergySave));
    } else if (this.energySaveModeService) {
      this.accessory.removeService(this.energySaveModeService);
    }

    // Standard Mode switch
    this.standardModeService = this.accessory.getServiceById(this.platform.Service.Switch, standardModeSubtype);
    if (this.configDev.CD_options.standardModeSwitch) {
      this.standardModeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, standardModeSubtype);
      this.handleConfiguredName(this.standardModeService, standardModeSubtype, 'Standard Mode');
      this.standardModeService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(() => this.getMode(Mode.Standard))
        .onSet((value) => this.setMode(value, Mode.Standard));
    } else if (this.standardModeService) {
      this.accessory.removeService(this.standardModeService);
    }

    // E-Heater Mode switch
    this.eHeaterService = this.accessory.getServiceById(this.platform.Service.Switch, eHeaterSubtype);
    if (this.configDev.CD_options.eHeaterModeSwitch) {
      this.eHeaterService ??= this.accessory.addService(this.platform.Service.Switch, undefined, eHeaterSubtype);
      this.handleConfiguredName(this.eHeaterService, eHeaterSubtype, 'E-Heater Mode');
      this.eHeaterService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(() => this.getMode(Mode.Compatibilizing))
        .onSet((value) => this.setMode(value, Mode.Compatibilizing));
    } else if (this.eHeaterService) {
      this.accessory.removeService(this.eHeaterService);
    }

    // Smart Mode switch
    this.smartModeService = this.accessory.getServiceById(this.platform.Service.Switch, smartModeSubtype);
    if (this.configDev.CD_options.smartModeSwitch) {
      this.smartModeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, smartModeSubtype);
      this.handleConfiguredName(this.smartModeService, smartModeSubtype, 'Smart Mode');
      this.smartModeService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(() => this.getMode(Mode.Smart))
        .onSet((value) => this.setMode(value, Mode.Smart));
    } else if (this.smartModeService) {
      this.accessory.removeService(this.smartModeService);
    }

    // Disinfection Service
    this.disinfectionService = this.accessory.getServiceById(this.platform.Service.Switch, disinfectionSubtype);
    if (this.configDev.CD_options.disinfectionSwitch) {
      this.disinfectionService ??= this.accessory.addService(this.platform.Service.Switch, undefined, disinfectionSubtype);
      this.handleConfiguredName(this.disinfectionService, disinfectionSubtype, 'Disinfection');
      this.disinfectionService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getDisinfection.bind(this)).onSet(this.setDisinfection.bind(this));
    } else if (this.disinfectionService) {
      this.accessory.removeService(this.disinfectionService);
    }
  }

  async updateCharacteristics(attributes: Partial<CDAttributes>) {
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      let updateState = false;
      switch (k.toLowerCase()) {
        case 'power':
          updateState = true;
          break;
        case 'mode':
          updateState = true;
          break;
        case 'target_temperature':
          this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.getTargetTemperature());
          break;
        case 'current_temperature':
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
          updateState = true;
          break;
        case 'sterilize':
          this.disinfectionService?.updateCharacteristic(this.platform.Characteristic.Active, this.getDisinfection());
          break;
        default:
          this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
          break;
      }
      if (updateState) {
        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentHeaterCoolerState());

        this.energySaveModeService?.updateCharacteristic(this.platform.Characteristic.Active, this.getMode(Mode.EnergySave));
        this.standardModeService?.updateCharacteristic(this.platform.Characteristic.Active, this.getMode(Mode.Standard));
        this.eHeaterService?.updateCharacteristic(this.platform.Characteristic.Active, this.getMode(Mode.Compatibilizing));
        this.smartModeService?.updateCharacteristic(this.platform.Characteristic.Active, this.getMode(Mode.Smart));
      }
    }
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

  async setMode(value: CharacteristicValue, mode: Mode) {
    await this.device.set_attribute({ MODE: value ? mode : Mode.Standard });
  }

  getDisinfection(): CharacteristicValue {
    return this.device.attributes.STERILIZE === true;
  }

  async setDisinfection(value: CharacteristicValue) {
    await this.device.set_sterilize(value as boolean);
  }
}
