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
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaACDevice from '../devices/ac/MideaACDevice.js';
import type { ACAttributes } from '../devices/ac/MideaACDevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import { type DeviceConfig, SwingAngle, SwingMode } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';

export default class AirConditionerAccessory extends BaseAccessory<MideaACDevice> {
  protected service: Service;
  private outDoorTemperatureService?: Service;
  private displayService?: Service;
  private fanOnlyService?: Service;
  private fanService?: Service;
  private ecoModeService?: Service;
  private breezeAwayService?: Service;
  private dryModeService?: Service;
  private boostModeService?: Service;
  private auxService?: Service;
  private auxHeatingService?: Service;
  private selfCleanService?: Service;
  private ionService?: Service;
  private rateSelectService?: Service;
  private sleepModeService?: Service;

  private swingAngleService?: Service;

  private swingAngleMainControl: SwingAngle;

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

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onGet(this.getTemperatureDisplayUnits.bind(this))
      .onSet(this.setTemperatureDisplayUnits.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState).onGet(this.getCurrentHeaterCoolerState.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getTargetHeaterCoolerState.bind(this))
      .onSet(this.setTargetHeaterCoolerState.bind(this))
      .setProps({
        validValues: this.configDev.AC_options.heatingCapable
          ? [
              this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
              this.platform.Characteristic.TargetHeaterCoolerState.HEAT,
              this.platform.Characteristic.TargetHeaterCoolerState.COOL,
            ]
          : [this.platform.Characteristic.TargetHeaterCoolerState.AUTO, this.platform.Characteristic.TargetHeaterCoolerState.COOL],
      });

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

    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).onGet(this.getRotationSpeed.bind(this)).onSet(this.setRotationSpeed.bind(this));

    // Swing modes
    if (this.configDev.AC_options.swing.mode !== SwingMode.NONE) {
      this.service.getCharacteristic(this.platform.Characteristic.SwingMode).onGet(this.getSwingMode.bind(this)).onSet(this.setSwingMode.bind(this));
    }

    // Outdoor temperature sensor
    this.outDoorTemperatureService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'Outdoor');
    if (this.configDev.AC_options.outDoorTemp) {
      this.outDoorTemperatureService ??= this.accessory.addService(this.platform.Service.TemperatureSensor, `${this.device.name} Outdoor`, 'Outdoor');
      this.outDoorTemperatureService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Outdoor`);
      this.outDoorTemperatureService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Outdoor`);
      this.outDoorTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getOutdoorTemperature.bind(this));
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

    // Fan-only mode switch
    this.fanOnlyService = this.accessory.getServiceById(this.platform.Service.Switch, 'FanOnly');
    if (this.configDev.AC_options.fanOnlyModeSwitch) {
      this.fanOnlyService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} FanOnly`, 'FanOnly');
      this.fanOnlyService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Fan-only Mode`);
      this.fanOnlyService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Fan-only Mode`);
      this.fanOnlyService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getFanOnlyMode.bind(this)).onSet(this.setFanOnlyMode.bind(this));
    } else if (this.fanOnlyService) {
      this.accessory.removeService(this.fanOnlyService);
    }

    // Fan accessory
    this.fanService = this.accessory.getServiceById(this.platform.Service.Fanv2, 'Fan');
    if (this.configDev.AC_options.fanAccessory) {
      this.fanService ??= this.accessory.addService(this.platform.Service.Fanv2, `${this.device.name} Fan`, 'Fan');
      this.fanService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Fan`);
      this.fanService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Fan`);
      this.fanService.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));
      this.fanService
        .getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .onGet(this.getRotationSpeed.bind(this))
        .onSet(this.setRotationSpeed.bind(this));
      this.fanService.getCharacteristic(this.platform.Characteristic.TargetFanState).onGet(this.getFanState.bind(this)).onSet(this.setFanState.bind(this));
      this.fanService.getCharacteristic(this.platform.Characteristic.SwingMode).onGet(this.getSwingMode.bind(this)).onSet(this.setSwingMode.bind(this));
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
      this.displayService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getDisplayActive.bind(this)).onSet(this.setDisplayActive.bind(this));
    } else if (this.displayService) {
      this.accessory.removeService(this.displayService);
    }

    // Eco mode switch
    this.ecoModeService = this.accessory.getServiceById(this.platform.Service.Switch, 'EcoMode');
    if (this.configDev.AC_options.ecoSwitch) {
      this.ecoModeService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Eco`, 'EcoMode');
      this.ecoModeService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Eco`);
      this.ecoModeService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Eco`);
      this.ecoModeService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getEcoMode.bind(this)).onSet(this.setEcoMode.bind(this));
    } else if (this.ecoModeService) {
      this.accessory.removeService(this.ecoModeService);
    }

    // Breeze away switch
    this.breezeAwayService = this.accessory.getServiceById(this.platform.Service.Switch, 'BreezeAway');
    if (this.configDev.AC_options.breezeAwaySwitch) {
      this.breezeAwayService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Breeze`, 'BreezeAway');
      this.breezeAwayService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Breeze`);
      this.breezeAwayService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Breeze`);
      this.breezeAwayService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getBreezeAway.bind(this)).onSet(this.setBreezeAway.bind(this));
    } else if (this.breezeAwayService) {
      this.accessory.removeService(this.breezeAwayService);
    }

    // Dry mode switch
    this.dryModeService = this.accessory.getServiceById(this.platform.Service.Switch, 'DryMode');
    if (this.configDev.AC_options.dryModeSwitch) {
      this.dryModeService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Dry`, 'DryMode');
      this.dryModeService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Dry`);
      this.dryModeService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Dry`);
      this.dryModeService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getDryMode.bind(this)).onSet(this.setDryMode.bind(this));
    } else if (this.dryModeService) {
      this.accessory.removeService(this.dryModeService);
    }

    this.boostModeService = this.accessory.getServiceById(this.platform.Service.Switch, 'BoostMode');
    if (this.configDev.AC_options.boostModeSwitch) {
      this.boostModeService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Boost`, 'BoostMode');
      this.boostModeService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Boost`);
      this.boostModeService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Boost`);
      this.boostModeService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getBoostMode.bind(this)).onSet(this.setBoostMode.bind(this));
    } else if (this.boostModeService) {
      this.accessory.removeService(this.boostModeService);
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
      this.auxHeatingService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getAuxHeating.bind(this)).onSet(this.setAuxHeating.bind(this));
    } else if (this.auxHeatingService) {
      this.accessory.removeService(this.auxHeatingService);
    }

    // Self-cleaning switch
    this.selfCleanService = this.accessory.getServiceById(this.platform.Service.Switch, 'SelfClean');
    if (this.configDev.AC_options.selfCleanSwitch) {
      this.selfCleanService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Self-cleaning`, 'SelfClean');
      this.selfCleanService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Self-cleaning`);
      this.selfCleanService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Self-cleaning`);
      this.selfCleanService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getSelfCleanState.bind(this))
        .onSet(this.setSelfCleanState.bind(this));
    } else if (this.selfCleanService) {
      this.accessory.removeService(this.selfCleanService);
    }

    // ION switch
    this.ionService = this.accessory.getServiceById(this.platform.Service.Switch, 'ION');
    if (this.configDev.AC_options.ionSwitch) {
      this.ionService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} ION`, 'ION');
      this.ionService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} ION`);
      this.ionService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} ION`);
      this.ionService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getIonState.bind(this)).onSet(this.setIonState.bind(this));
    } else if (this.ionService) {
      this.accessory.removeService(this.ionService);
    }

    // Rate select slider
    this.rateSelectService = this.accessory.getServiceById(this.platform.Service.Lightbulb, 'Gear');
    if (this.configDev.AC_options.rateSelector) {
      this.rateSelectService ??= this.accessory.addService(this.platform.Service.Lightbulb, `${this.device.name} Gear`, 'Gear');
      this.rateSelectService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Gear`);
      this.rateSelectService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Gear`);
      this.rateSelectService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));
      this.rateSelectService
        .getCharacteristic(this.platform.Characteristic.Brightness)
        .setProps({
          validValues: [0, 50, 75, 100],
        })
        .onGet(this.getRateSelect.bind(this))
        .onSet(this.setRateSelect.bind(this));
    } else if (this.rateSelectService) {
      this.accessory.removeService(this.rateSelectService);
    }

    // Sleep mode accessory
    this.sleepModeService = this.accessory.getServiceById(this.platform.Service.Switch, 'SleepMode');
    if (this.configDev.AC_options.sleepModeSwitch) {
      this.sleepModeService ??= this.accessory.addService(this.platform.Service.Switch, `${this.device.name} Sleep`, 'SleepMode');
      this.sleepModeService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Sleep`);
      this.sleepModeService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getSleepMode.bind(this)).onSet(this.setSleepMode.bind(this));
    } else if (this.sleepModeService) {
      this.accessory.removeService(this.sleepModeService);
    }

    const swingProps = this.configDev.AC_options.swing;
    this.swingAngleMainControl =
      swingProps.mode === SwingMode.VERTICAL || (swingProps.mode === SwingMode.BOTH && swingProps.angleMainControl === SwingAngle.VERTICAL)
        ? SwingAngle.VERTICAL
        : SwingAngle.HORIZONTAL;
    // Swing angle accessory
    this.swingAngleService = this.accessory.getServiceById(this.platform.Service.WindowCovering, 'SwingAngle');
    if (swingProps.mode !== SwingMode.NONE && swingProps.angleAccessory) {
      this.swingAngleService ??= this.accessory.addService(this.platform.Service.WindowCovering, `${this.device.name} Swing`, 'SwingAngle');
      this.swingAngleService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Swing`);
      this.swingAngleService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Swing`);
      this.swingAngleService.getCharacteristic(this.platform.Characteristic.CurrentPosition).onGet(this.getSwingAngleCurrentPosition.bind(this));
      this.swingAngleService
        .getCharacteristic(this.platform.Characteristic.TargetPosition)
        .onGet(this.getSwingAngleTargetPosition.bind(this))
        .onSet(this.setSwingAngleTargetPosition.bind(this));
      this.swingAngleService.getCharacteristic(this.platform.Characteristic.PositionState).onGet(this.getSwingAnglePositionState.bind(this));

      if (swingProps.mode === SwingMode.BOTH) {
        this.swingAngleService
          .getCharacteristic(this.platform.Characteristic.CurrentHorizontalTiltAngle)
          .onGet(this.getSwingAngleCurrentHorizontalTiltAngle.bind(this));
        this.swingAngleService
          .getCharacteristic(this.platform.Characteristic.TargetHorizontalTiltAngle)
          .onGet(this.getSwingAngleTargetHorizontalTiltAngle.bind(this))
          .onSet(this.setSwingAngleTargetHorizontalTiltAngle.bind(this));
        this.swingAngleService
          .getCharacteristic(this.platform.Characteristic.CurrentVerticalTiltAngle)
          .onGet(this.getSwingAngleCurrentVerticalTiltAngle.bind(this));
        this.swingAngleService
          .getCharacteristic(this.platform.Characteristic.TargetVerticalTiltAngle)
          .onGet(this.getSwingAngleTargetVerticalTiltAngle.bind(this))
          .onSet(this.setSwingAngleTargetVerticalTiltAngle.bind(this));
      }
    }
    // Misc
    this.device.attributes.PROMPT_TONE = this.configDev.AC_options.audioFeedback;
    this.device.attributes.TEMP_FAHRENHEIT = this.configDev.AC_options.fahrenheit;
  }

  /*********************************************************************
   * Callback function called by MideaDevice whenever there is a change to
   * any attribute value.
   */
  protected async updateCharacteristics(attributes: Partial<ACAttributes>) {
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      let updateState = false;
      switch (k.toLowerCase()) {
        case 'power':
          updateState = true;
          break;
        case 'temp_fahrenheit':
          this.service.updateCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits, this.getTemperatureDisplayUnits());
          break;
        case 'screen_display':
        case 'screen_display_new':
          this.displayService?.updateCharacteristic(this.platform.Characteristic.On, this.getDisplayActive());
          break;
        case 'target_temperature':
          // If MODE is 4 then device is heating.  Therefore target temperature value must be heating target? Right?
          if (this.device.attributes.MODE === 4) {
            this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.getTargetTemperature());
          } else {
            this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, this.getTargetTemperature());
          }
          updateState = true;
          break;
        case 'indoor_temperature':
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
          break;
        case 'outdoor_temperature':
          this.outDoorTemperatureService?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getOutdoorTemperature());
          break;
        case 'fan_speed':
          updateState = true;
          break;
        case 'fan_auto':
          this.fanService?.updateCharacteristic(this.platform.Characteristic.TargetFanState, this.getFanState());
          break;
        case 'swing_vertical':
        case 'swing_horizontal':
          this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, this.getSwingMode());
          break;
        case 'mode':
          updateState = true;
          break;
        case 'eco_mode':
          this.ecoModeService?.updateCharacteristic(this.platform.Characteristic.On, this.getEcoMode());
          break;
        case 'indirect_wind':
          this.breezeAwayService?.updateCharacteristic(this.platform.Characteristic.On, this.getBreezeAway());
          break;
        case 'aux_heating':
          this.auxHeatingService?.updateCharacteristic(this.platform.Characteristic.On, this.getAuxHeating());
          break;
        case 'smart_eye':
          this.auxService?.updateCharacteristic(this.platform.Characteristic.On, this.getAux());
          break;
        case 'wind_swing_lr_angle':
        case 'wind_swing_ud_angle':
          this.swingAngleService?.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.getSwingAngleCurrentPosition());
          this.swingAngleService?.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.getSwingAngleTargetPosition());

          if (this.configDev.AC_options.swing.mode === SwingMode.BOTH) {
            this.swingAngleService?.updateCharacteristic(
              this.platform.Characteristic.CurrentHorizontalTiltAngle,
              this.getSwingAngleCurrentHorizontalTiltAngle(),
            );
            this.swingAngleService?.updateCharacteristic(this.platform.Characteristic.CurrentVerticalTiltAngle, this.getSwingAngleCurrentVerticalTiltAngle());
            this.swingAngleService?.updateCharacteristic(this.platform.Characteristic.TargetHorizontalTiltAngle, this.getSwingAngleTargetHorizontalTiltAngle());
            this.swingAngleService?.updateCharacteristic(this.platform.Characteristic.TargetVerticalTiltAngle, this.getSwingAngleTargetVerticalTiltAngle());
          }
          break;
        case 'self_clean':
          updateState = true;
          this.selfCleanService?.updateCharacteristic(this.platform.Characteristic.On, this.getSelfCleanState());
          break;
        case 'ion':
          this.ionService?.updateCharacteristic(this.platform.Characteristic.On, this.getIonState());
          break;
        case 'rate_select':
          this.rateSelectService?.updateCharacteristic(this.platform.Characteristic.Brightness, this.getRateSelect());
          break;
        default:
          this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
      }
      if (updateState) {
        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.getTargetHeaterCoolerState());
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentHeaterCoolerState());
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());

        this.fanOnlyService?.updateCharacteristic(this.platform.Characteristic.On, this.getFanOnlyMode());
        this.fanService?.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
        this.fanService?.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
        this.dryModeService?.updateCharacteristic(this.platform.Characteristic.On, this.getDryMode());
        this.displayService?.updateCharacteristic(this.platform.Characteristic.On, this.getDisplayActive());
        this.ecoModeService?.updateCharacteristic(this.platform.Characteristic.On, this.getEcoMode());
        this.breezeAwayService?.updateCharacteristic(this.platform.Characteristic.On, this.getBreezeAway());
        this.auxService?.updateCharacteristic(this.platform.Characteristic.On, this.getAux());
        this.auxHeatingService?.updateCharacteristic(this.platform.Characteristic.On, this.getAuxHeating());
      }
    }
  }

  /*********************************************************************
   * Callback functions for each Homebridge/HomeKit service
   *
   */
  getActive(): CharacteristicValue {
    // Show as inactive if device is off
    return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    await this.device.set_attribute({ POWER: !!value });
    this.device.attributes.SCREEN_DISPLAY = !!value;
    this.displayService?.updateCharacteristic(this.platform.Characteristic.On, !!value);
  }

  getTemperatureDisplayUnits(): CharacteristicValue {
    return this.device.attributes.TEMP_FAHRENHEIT
      ? this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT
      : this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
  }

  async setTemperatureDisplayUnits(value: CharacteristicValue) {
    await this.device.set_attribute({ TEMP_FAHRENHEIT: value === this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT });
  }

  getCurrentHeaterCoolerState(): CharacteristicValue {
    if (this.device.attributes.POWER && this.device.attributes.MODE > 0 && this.device.attributes.MODE < 5) {
      if (this.device.attributes.TARGET_TEMPERATURE < (this.device.attributes.INDOOR_TEMPERATURE ?? 0)) {
        if ([1, 2].includes(this.device.attributes.MODE)) {
          return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        }
        return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
      }

      if (this.device.attributes.TARGET_TEMPERATURE === this.device.attributes.INDOOR_TEMPERATURE) {
        return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
      }

      if (this.device.attributes.MODE === 4) {
        return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
      }

      return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
    }

    return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
  }

  getTargetHeaterCoolerState(): CharacteristicValue {
    if (this.device.attributes.MODE === 2) {
      return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
    }
    if (this.device.attributes.MODE === 4) {
      return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
    }
    return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        await this.device.set_attribute({ POWER: true, MODE: 1 });
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        await this.device.set_attribute({ POWER: true, MODE: 2 });
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        await this.device.set_attribute({ POWER: true, MODE: 4 });
        break;
    }
  }

  getCurrentTemperature(): CharacteristicValue {
    return this.device.attributes.INDOOR_TEMPERATURE ?? this.configDev.AC_options.minTemp;
  }

  getTargetTemperature(): CharacteristicValue {
    return Math.max(this.configDev.AC_options.minTemp, Math.min(this.configDev.AC_options.maxTemp, this.device.attributes.TARGET_TEMPERATURE));
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

  getFanState(): CharacteristicValue {
    return this.device.attributes.FAN_AUTO;
  }

  async setFanState(value: CharacteristicValue) {
    await this.device.set_fan_auto(value === this.platform.Characteristic.TargetFanState.AUTO);
  }

  async setTargetTemperature(value: CharacteristicValue) {
    const limitedValue = Math.max(this.configDev.AC_options.minTemp, Math.min(this.configDev.AC_options.maxTemp, value as number));
    await this.device.set_target_temperature(limitedValue);
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
          [SwingMode.HORIZONTAL, SwingMode.BOTH].includes(this.configDev.AC_options.swing.mode),
          [SwingMode.VERTICAL, SwingMode.BOTH].includes(this.configDev.AC_options.swing.mode),
        );
        break;
      case this.platform.Characteristic.SwingMode.SWING_DISABLED:
        await this.device.set_swing(false, false);
        break;
    }
  }

  getRotationSpeed(): CharacteristicValue {
    return Math.min(100, this.device.attributes.FAN_SPEED ?? 0);
  }

  async setRotationSpeed(value: CharacteristicValue) {
    await this.device.set_attribute({ FAN_SPEED: value as number });
  }

  getOutdoorTemperature(): CharacteristicValue {
    return this.device.attributes.OUTDOOR_TEMPERATURE ?? -270;
  }

  getDisplayActive(): CharacteristicValue {
    return this.device.attributes.SCREEN_DISPLAY === true;
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
    return this.device.attributes.POWER === true && this.device.attributes.MODE === 3;
  }

  async setDryMode(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, MODE: 3 });
    } else {
      await this.device.set_attribute({ POWER: false, MODE: 0 });
    }
  }

  getBoostMode(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.BOOST_MODE;
  }

  async setBoostMode(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, BOOST_MODE: true });
    } else {
      await this.device.set_attribute({ BOOST_MODE: false });
    }
  }

  getAux(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.SMART_EYE === true;
  }

  async setAux(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ SMART_EYE: true });
    } else {
      await this.device.set_attribute({ SMART_EYE: false });
    }
  }

  getAuxHeating(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.AUX_HEATING === true;
  }

  async setAuxHeating(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ AUX_HEATING: true });
    } else {
      await this.device.set_attribute({ AUX_HEATING: false });
    }
  }

  getSelfCleanState(): CharacteristicValue {
    return this.device.attributes.SELF_CLEAN === true;
  }

  async setSelfCleanState(value: CharacteristicValue) {
    await this.device.set_self_clean(value === true);
  }

  getIonState(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.ION === true;
  }

  async setIonState(value: CharacteristicValue) {
    await this.device.set_ion(value === true);
  }

  getRateSelect(): CharacteristicValue {
    return this.device.attributes.RATE_SELECT ?? 100;
  }

  async setRateSelect(value: CharacteristicValue) {
    await this.device.set_rate_select(value as number);
  }

  getSwingAngleCurrentPosition(): CharacteristicValue {
    const value = this.swingAngleMainControl === SwingAngle.VERTICAL ? this.device.attributes.WIND_SWING_UD_ANGLE : this.device.attributes.WIND_SWING_LR_ANGLE;

    return value === 1 ? 0 : value;
  }

  getSwingAngleTargetPosition(): CharacteristicValue {
    return this.getSwingAngleCurrentPosition();
  }

  async setSwingAngleTargetPosition(value: CharacteristicValue) {
    await this.device.set_swing_angle(this.swingAngleMainControl, Math.max(1, value as number));
  }

  getSwingAnglePositionState(): CharacteristicValue {
    return this.platform.Characteristic.PositionState.STOPPED;
  }

  getSwingAngleCurrentHorizontalTiltAngle(): CharacteristicValue {
    return this.device.attributes.WIND_SWING_LR_ANGLE === 1 ? 0 : this.device.attributes.WIND_SWING_LR_ANGLE;
  }

  getSwingAngleTargetHorizontalTiltAngle(): CharacteristicValue {
    return this.getSwingAngleCurrentHorizontalTiltAngle();
  }

  async setSwingAngleTargetHorizontalTiltAngle(value: CharacteristicValue) {
    await this.device.set_swing_angle(SwingAngle.HORIZONTAL, Math.max(1, value as number));
  }

  getSwingAngleCurrentVerticalTiltAngle(): CharacteristicValue {
    return this.device.attributes.WIND_SWING_UD_ANGLE === 1 ? 0 : this.device.attributes.WIND_SWING_UD_ANGLE;
  }

  getSwingAngleTargetVerticalTiltAngle(): CharacteristicValue {
    return this.getSwingAngleCurrentVerticalTiltAngle();
  }

  async setSwingAngleTargetVerticalTiltAngle(value: CharacteristicValue) {
    await this.device.set_swing_angle(SwingAngle.VERTICAL, Math.max(1, value as number));
  }

  getSleepMode(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.SLEEP_MODE
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE;
  }

  async setSleepMode(value: CharacteristicValue) {
    if (value === this.platform.Characteristic.Active.ACTIVE) {
      await this.device.set_attribute({ POWER: true, SLEEP_MODE: true });
    } else {
      await this.device.set_attribute({ SLEEP_MODE: false });
    }
  }
}
