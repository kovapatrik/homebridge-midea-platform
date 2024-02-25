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

  // Sensors/states
  private burningStateService?: Service;
  private protectionService?: Service;

  // Switches
  private zeroColdWaterService?: Service;
  private zeroColdPulseService?: Service;
  private smartVolumeService?: Service;

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

    // Burning state sensor
    this.burningStateService = this.accessory.getServiceById(this.platform.Service.MotionSensor, 'BurningState');
    if (this.configDev.E3_options.burningStateSensor) {
      this.burningStateService ??= this.accessory.addService(
        this.platform.Service.MotionSensor,
        `${this.device.name} Burning State`,
        'Burning State',
      );
      this.burningStateService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name}  Burning State`);
      this.burningStateService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name}  Burning State`);
      this.burningStateService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getBurningState.bind(this));
    } else if (this.burningStateService) {
      this.accessory.removeService(this.burningStateService);
    }

    // Protection sensor
    this.protectionService = this.accessory.getServiceById(this.platform.Service.MotionSensor, 'Protection');
    if (this.configDev.E3_options.protectionSensor) {
      this.protectionService ??= this.accessory.addService(
        this.platform.Service.MotionSensor,
        `${this.device.name} Protection`,
        'Protection',
      );
      this.protectionService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Protection`);
      this.protectionService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Protection`);
      this.protectionService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getProtection.bind(this));
    } else if (this.protectionService) {
      this.accessory.removeService(this.protectionService);
    }

    // Zero Cold Water switch
    this.zeroColdWaterService = this.accessory.getServiceById(this.platform.Service.Switch, 'ZeroColdWater');
    if (this.configDev.E3_options.zeroColdWaterSwitch) {
      this.zeroColdWaterService ??= this.accessory.addService(
        this.platform.Service.Switch,
        `${this.device.name} Zero Cold Water`,
        'Zero Cold Water',
      );
      this.zeroColdWaterService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Zero Cold Water`);
      this.zeroColdWaterService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Zero Cold Water`);
      this.zeroColdWaterService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getZeroColdWater.bind(this))
        .onSet(this.setZeroColdWater.bind(this));
    } else if (this.zeroColdWaterService) {
      this.accessory.removeService(this.zeroColdWaterService);
    }

    // Zero Cold Pulse switch
    this.zeroColdPulseService = this.accessory.getServiceById(this.platform.Service.Switch, 'ZeroColdPulse');
    if (this.configDev.E3_options.zeroColdPulseSwitch) {
      this.zeroColdPulseService ??= this.accessory.addService(
        this.platform.Service.Switch,
        `${this.device.name} Zero Cold Pulse`,
        'Zero Cold Pulse',
      );
      this.zeroColdPulseService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Zero Cold Pulse`);
      this.zeroColdPulseService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Zero Cold Pulse`);
      this.zeroColdPulseService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getZeroColdPulse.bind(this))
        .onSet(this.setZeroColdPulse.bind(this));
    } else if (this.zeroColdPulseService) {
      this.accessory.removeService(this.zeroColdPulseService);
    }

    // Smart Volume switch
    this.smartVolumeService = this.accessory.getServiceById(this.platform.Service.Switch, 'SmartVolume');
    if (this.configDev.E3_options.smartVolumeSwitch) {
      this.smartVolumeService ??= this.accessory.addService(
        this.platform.Service.Switch,
        `${this.device.name} Smart Volume`,
        'Smart Volume',
      );
      this.smartVolumeService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Smart Volume`);
      this.smartVolumeService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Smart Volume`);
      this.smartVolumeService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getSmartVolume.bind(this))
        .onSet(this.setSmartVolume.bind(this));
    } else if (this.smartVolumeService) {
      this.accessory.removeService(this.smartVolumeService);
    }

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
        case 'burning_state':
          this.burningStateService?.updateCharacteristic(this.platform.Characteristic.MotionDetected, v as boolean);
          break;
        case 'zero_cold_water':
          this.zeroColdWaterService?.updateCharacteristic(this.platform.Characteristic.On, v as boolean);
          break;
        case 'protection':
          this.protectionService?.updateCharacteristic(this.platform.Characteristic.MotionDetected, v as boolean);
          break;
        case 'zero_cold_pulse':
          this.zeroColdPulseService?.updateCharacteristic(this.platform.Characteristic.On, v as boolean);
          break;
        case 'smart_volume':
          this.smartVolumeService?.updateCharacteristic(this.platform.Characteristic.On, v as boolean);
          break;
        case 'current_temperature':
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, v as number);
          updateState = true;
          break;
        case 'target_temperature':
          this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, v as number);
          updateState = true;
          break;
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

  getBurningState(): CharacteristicValue {
    return this.device.attributes.BURNING_STATE;
  }

  getProtection(): CharacteristicValue {
    return this.device.attributes.PROTECTION;
  }

  getZeroColdWater(): CharacteristicValue {
    return this.device.attributes.ZERO_COLD_WATER;
  }

  async setZeroColdWater(value: CharacteristicValue) {
    await this.device.set_attribute({ ZERO_COLD_WATER: !!value });
  }

  getZeroColdPulse(): CharacteristicValue {
    return this.device.attributes.ZERO_COLD_PULSE;
  }

  async setZeroColdPulse(value: CharacteristicValue) {
    await this.device.set_attribute({ ZERO_COLD_PULSE: !!value });
  }

  getSmartVolume(): CharacteristicValue {
    return this.device.attributes.SMART_VOLUME;
  }

  async setSmartVolume(value: CharacteristicValue) {
    await this.device.set_attribute({ SMART_VOLUME: !!value });
  }
}
