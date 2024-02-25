/***********************************************************************
 * Midea Platform Air Conditioner Accessory class
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import { CharacteristicValue, Service } from 'homebridge';
import { MideaAccessory, MideaPlatform } from '../platform';
import BaseAccessory from './BaseAccessory';
import { DeviceConfig, SwingMode } from '../platformUtils';
import MideaACDevice, { ACAttributes } from '../devices/ac/MideaACDevice';

export default class AirConditionerAccessory extends BaseAccessory<MideaACDevice> {
  private service: Service;
  private outDoorTemperatureService?: Service;
  private displayService?: Service;
  private fanService?: Service;
  private ecoModeService?: Service;
  private breezeAwayService?: Service;
  private dryModeService?: Service;
  private auxService?: Service;
  private auxHeatingService?: Service;

  /*********************************************************************
   * Constructor registers all the service types with Homebridge, registers
   * a callback function with the MideaDevice class, and requests device status.
   */
  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaACDevice,
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
      .onSet(this.setTargetHeaterCoolerState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this))
      .setProps({
        minValue: this.configDev.AC_options.minTemp,
        maxValue: this.configDev.AC_options.maxTemp,
        minStep: this.configDev.AC_options.tempStep,
      });

    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this))
      .setProps({
        minValue: this.configDev.AC_options.minTemp,
        maxValue: this.configDev.AC_options.maxTemp,
        minStep: this.configDev.AC_options.tempStep,
      });

    this.service
      .getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this))
      .setProps({
        minValue: 0,
        maxValue: 102,
        minStep: 1,
      });

    // Swing modes
    if (this.configDev.AC_options.swingMode !== SwingMode.NONE) {
      this.service
        .getCharacteristic(this.platform.Characteristic.SwingMode)
        .onGet(this.getSwingMode.bind(this))
        .onSet(this.setSwingMode.bind(this));
    }

    // Outdoor temperature sensor
    this.outDoorTemperatureService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'Outdoor');
    if (this.configDev.AC_options.outDoorTemp) {
      this.outDoorTemperatureService ??= this.accessory.addService(
        this.platform.Service.TemperatureSensor,
        `${this.device.name} Outdoor`,
        'Outdoor',
      );
      this.outDoorTemperatureService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Outdoor`);
      this.outDoorTemperatureService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Outdoor`);
      this.outDoorTemperatureService
        .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getOutdoorTemperature.bind(this));
      this.outDoorTemperatureService
        .getCharacteristic(this.platform.Characteristic.StatusFault)
        .onGet(() =>
          this.device.attributes.OUTDOOR_TEMPERATURE === undefined
            ? this.platform.Characteristic.StatusFault.GENERAL_FAULT
            : this.platform.Characteristic.StatusFault.NO_FAULT,
        );
    } else if (this.outDoorTemperatureService) {
      this.accessory.removeService(this.outDoorTemperatureService);
    }

    // Fan-only mode
    this.fanService = this.accessory.getServiceById(this.platform.Service.Fanv2, 'Fan');
    if (this.configDev.AC_options.fanOnlyMode) {
      this.fanService ??= this.accessory.addService(this.platform.Service.Fanv2, `${this.device.name} Fan`, 'Fan');
      this.fanService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Fan`);
      this.fanService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Fan`);
      this.fanService
        .getCharacteristic(this.platform.Characteristic.Active)
        .onGet(this.getFanOnlyMode.bind(this))
        .onSet(this.setFanOnlyMode.bind(this));
      this.fanService
        .getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .onGet(this.getRotationSpeed.bind(this))
        .onSet(this.setRotationSpeed.bind(this))
        .setProps({
          minValue: 0,
          maxValue: 102,
          minStep: 1,
        });
    } else if (this.fanService) {
      this.accessory.removeService(this.fanService);
    }

    // Display switch
    this.displayService = this.accessory.getServiceById(this.platform.Service.Switch, 'Display');
    if (this.configDev.AC_options.displaySwitch.flag) {
      this.device.set_alternate_switch_display(this.configDev.AC_options.displaySwitch.command);
      this.displayService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Display`, 'Display');
      this.displayService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Display`);
      this.displayService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Display`);
      this.displayService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getDisplayActive.bind(this))
        .onSet(this.setDisplayActive.bind(this));
    } else if (this.displayService) {
      this.accessory.removeService(this.displayService);
    }

    // Eco mode switch
    this.ecoModeService = this.accessory.getServiceById(this.platform.Service.Switch, 'EcoMode');
    if (this.configDev.AC_options.ecoSwitch) {
      this.ecoModeService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Eco`, 'EcoMode');
      this.ecoModeService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Eco`);
      this.ecoModeService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Eco`);
      this.ecoModeService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getEcoMode.bind(this))
        .onSet(this.setEcoMode.bind(this));
    } else if (this.ecoModeService) {
      this.accessory.removeService(this.ecoModeService);
    }

    // Breeze away switch
    this.breezeAwayService = this.accessory.getServiceById(this.platform.Service.Switch, 'BreezeAway');
    if (this.configDev.AC_options.breezeAwaySwitch) {
      this.breezeAwayService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Breeze`, 'BreezeAway');
      this.breezeAwayService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Breeze`);
      this.breezeAwayService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Breeze`);
      this.breezeAwayService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getBreezeAway.bind(this))
        .onSet(this.setBreezeAway.bind(this));
    } else if (this.breezeAwayService) {
      this.accessory.removeService(this.breezeAwayService);
    }

    // Dry mode switch
    this.dryModeService = this.accessory.getServiceById(this.platform.Service.Switch, 'DryMode');
    if (this.configDev.AC_options.dryModeSwitch) {
      this.dryModeService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Dry`, 'DryMode');
      this.dryModeService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Dry`);
      this.dryModeService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Dry`);
      this.dryModeService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getDryMode.bind(this))
        .onSet(this.setDryMode.bind(this));
    }

    // Aux switch
    this.auxService = this.accessory.getServiceById(this.platform.Service.Switch, 'Aux');
    if (this.configDev.AC_options.auxHeatingSwitches) {
      this.auxService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Aux`, 'Aux');
      this.auxService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Aux`);
      this.auxService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Aux`);
      this.auxService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getAux.bind(this)).onSet(this.setAux.bind(this));
    } else if (this.auxService) {
      this.accessory.removeService(this.auxService);
    }

    // Aux+Heat switch
    this.auxHeatingService = this.accessory.getServiceById(this.platform.Service.Switch, 'AuxHeating');
    if (this.configDev.AC_options.auxHeatingSwitches) {
      this.auxHeatingService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Aux+Heat`, 'AuxHeating');
      this.auxHeatingService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Aux+Heat`);
      this.auxHeatingService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Aux+Heat`);
      this.auxHeatingService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getAuxHeating.bind(this))
        .onSet(this.setAuxHeating.bind(this));
    } else if (this.auxHeatingService) {
      this.accessory.removeService(this.auxHeatingService);
    }

    // Misc
    this.device.attributes.PROMPT_TONE = this.configDev.AC_options.audioFeedback;
    this.device.attributes.TEMP_FAHRENHEIT = this.configDev.AC_options.fahrenheit;

    // Register a callback function with MideaDevice and then refresh device status.  The callback
    // is called whenever there is a change in any attribute value from the device.
    this.device.on('update', this.updateCharacteristics.bind(this));
    this.device.refresh_status();
  }

  /*********************************************************************
   * Callback function called by MideaDevice whenever there is a change to
   * any attribute value.
   */
  private async updateCharacteristics(attributes: Partial<ACAttributes>) {
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
        case 'screen_display':
          this.displayService?.updateCharacteristic(this.platform.Characteristic.On, !!v);
          break;
        case 'target_temperature':
          // If MODE is 4 then device is heating.  Therefore target temperature value must be heating target? Right?
          if (this.device.attributes.MODE === 4) {
            this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, v as CharacteristicValue);
          } else {
            this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, v as CharacteristicValue);
          }
          updateState = true;
          break;
        case 'indoor_temperature':
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, v as CharacteristicValue);
          updateState = true;
          break;
        case 'outdoor_temperature':
          this.outDoorTemperatureService?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, v as CharacteristicValue);
          break;
        case 'fan_speed':
          this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, v as CharacteristicValue);
          break;
        case 'swing_vertical':
        case 'swing_horizontal':
          this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, this.getSwingMode());
          break;
        case 'mode':
          updateState = true;
          break;
        case 'eco_mode':
          this.ecoModeService?.updateCharacteristic(this.platform.Characteristic.On, !!v);
          break;
        case 'indirect_wind':
          this.breezeAwayService?.updateCharacteristic(this.platform.Characteristic.On, !!v);
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
  async getActive(): Promise<CharacteristicValue> {
    return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    await this.device.set_attribute({ POWER: !!value });
    this.device.attributes.SCREEN_DISPLAY = !!value;
    this.displayService?.updateCharacteristic(this.platform.Characteristic.On, !!value);
  }

  getCurrentHeaterCoolerState(): CharacteristicValue {
    if (this.device.attributes.POWER && this.device.attributes.MODE > 0) {
      if (this.device.attributes.TARGET_TEMPERATURE < (this.device.attributes.INDOOR_TEMPERATURE ?? 0)) {
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
    return this.device.attributes.INDOOR_TEMPERATURE ?? this.configDev.AC_options.minTemp;
  }

  getTargetTemperature(): CharacteristicValue {
    return Math.max(
      this.configDev.AC_options.minTemp,
      Math.min(this.configDev.AC_options.maxTemp, this.device.attributes.TARGET_TEMPERATURE),
    );
  }

  getFanOnlyMode(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.MODE === 5;
  }

  async setFanOnlyMode(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, MODE: 5 });
    } else {
      await this.device.set_attribute({ POWER: false, MODE: 0 });
    }
  }

  async setTargetTemperature(value: CharacteristicValue) {
    value = Math.max(this.configDev.AC_options.minTemp, Math.min(this.configDev.AC_options.maxTemp, value as number));
    await this.device.set_target_temperature(value);
  }

  getSwingMode(): CharacteristicValue {
    return this.device.attributes.SWING_HORIZONTAL || this.device.attributes.SWING_VERTICAL
      ? this.platform.Characteristic.SwingMode.SWING_ENABLED
      : this.platform.Characteristic.SwingMode.SWING_DISABLED;
  }

  async setSwingMode(value: CharacteristicValue) {
    switch (value) {
      case this.platform.Characteristic.SwingMode.SWING_ENABLED:
        await this.device.set_swing(
          [SwingMode.HORIZONTAL, SwingMode.BOTH].includes(this.configDev.AC_options.swingMode!),
          [SwingMode.VERTICAL, SwingMode.BOTH].includes(this.configDev.AC_options.swingMode!),
        );
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
    if (value > 100) {
      value = 102;
    }
    await this.device.set_attribute({ FAN_SPEED: value });
  }

  getOutdoorTemperature(): CharacteristicValue {
    return this.device.attributes.OUTDOOR_TEMPERATURE ?? -270;
  }

  getDisplayActive(): CharacteristicValue {
    return !!this.device.attributes.SCREEN_DISPLAY; // force boolean
  }

  async setDisplayActive(value: CharacteristicValue) {
    if (this.device.attributes.POWER) {
      await this.device.set_attribute({ SCREEN_DISPLAY: !!value });
    }
  }

  getEcoMode(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.ECO_MODE;
  }

  async setEcoMode(value: CharacteristicValue) {
    await this.device.set_attribute({ ECO_MODE: !!value });
  }

  getBreezeAway(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.INDIRECT_WIND;
  }

  async setBreezeAway(value: CharacteristicValue) {
    await this.device.set_attribute({ INDIRECT_WIND: !!value });
  }

  getDryMode(): CharacteristicValue {
    return this.device.attributes.MODE === 3;
  }

  async setDryMode(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, MODE: 3 });
    } else {
      await this.device.set_attribute({ POWER: false, MODE: 0 });
    }
  }

  getAux(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.SMART_EYE === true;
  }

  async setAux(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, SMART_EYE: true, AUX_HEATING: false });
    } else {
      await this.device.set_attribute({ POWER: false, SMART_EYE: false });
    }
  }

  getAuxHeating(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.AUX_HEATING === true;
  }

  async setAuxHeating(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, AUX_HEATING: true, SMART_EYE: false });
    } else {
      await this.device.set_attribute({ POWER: false, AUX_HEATING: false });
    }
  }
}
