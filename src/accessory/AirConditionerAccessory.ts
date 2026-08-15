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
// @ts-ignore
import FakegatoHistory from 'fakegato-history';
import type MideaACDevice from '../devices/ac/MideaACDevice.js';
import { type ACAttributes, AUTO_FAN_SPEED } from '../devices/ac/MideaACDevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import { ACMode, ACServiceType, type DeviceConfig, SwingAngle, SwingMode } from '../platformUtils.js';
import BaseAccessory, { limitValue } from './BaseAccessory.js';

const outDoorTemperatureSubtype = 'outdoor';
const displaySubtype = 'display';
const fanOnlySubtype = 'fanOnly';
const fanSubtype = 'fan';
const fanAutoSubtype = 'fanAuto';
const ecoModeSubtype = 'ecoMode';
const coolModeSubtype = 'coolMode';
const heatModeSubtype = 'heatMode';
const autoModeSubtype = 'autoMode';
const breezeAwaySubtype = 'breezeAway';
const dryModeSubtype = 'dryMode';
const boostModeSubtype = 'boostMode';
const auxSubtype = 'aux';
const auxHeatingSubtype = 'auxHeating';
const selfCleanSubtype = 'selfClean';
const ionSubtype = 'ion';
const outSilentSubtype = 'outSilent';
const rateSelectSubtype = 'rateSelect';
const sleepModeSubtype = 'sleepMode';
const swingAngleSubtype = 'swingAngle';
const comfortModeSubtype = 'comfortMode';
const temperatureSensorSubtype = 'temperatureSensor';
const humiditySensorSubtype = 'humidity';
const smartEyeSubtype = 'smartEye';
const audioFeedbackSubtype = 'audioFeedback';
const timerSubtype = 'timer';
const powerMeterSubtype = 'powerMeter';
const powerWattsSubtype = 'powerWatts';
const energykWhSubtype = 'energykWh';

// Custom characteristics for Eve Home compatibility
const EVE_POWER_UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
const EVE_ENERGY_UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';

export default class AirConditionerAccessory extends BaseAccessory<MideaACDevice> {
  protected service: Service;

  private outDoorTemperatureService?: Service;
  private displayService?: Service;
  private fanOnlyService?: Service;
  private fanService?: Service;
  private fanAutoService?: Service;
  private coolModeService?: Service;
  private heatModeService?: Service;
  private autoModeService?: Service;
  private ecoModeService?: Service;
  private breezeAwayService?: Service;
  private dryModeService?: Service;
  private boostModeService?: Service;
  private auxService?: Service;
  private auxHeatingService?: Service;
  private selfCleanService?: Service;
  private ionService?: Service;
  private outSilentService?: Service;
  private rateSelectService?: Service;
  private sleepModeService?: Service;
  private swingAngleService?: Service;
  private comfortModeService?: Service;
  private temperatureSensorService?: Service;
  private humiditySensorService?: Service;
  private smartEyeService?: Service;
  private audioFeedbackService?: Service;
  private timerService?: Service;
  private powerMeterService?: Service;
  private powerWattsService?: Service;
  private energykWhService?: Service;
  private historyService?: any;

  private timerEnd?: number;
  private timerTimeout?: NodeJS.Timeout;

  private swingAngleMainControl: SwingAngle;
  private heatingThresholdTemperature: number;
  private coolingThresholdTemperature: number;
  private readonly useThermostat: boolean;

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

    this.useThermostat = this.configDev.AC_options.serviceType === ACServiceType.THERMOSTAT;

    // Misc initialization
    const swingProps = this.configDev.AC_options.swing;
    this.swingAngleMainControl =
      swingProps.mode === SwingMode.VERTICAL || (swingProps.mode === SwingMode.BOTH && swingProps.angleMainControl === SwingAngle.VERTICAL)
        ? SwingAngle.VERTICAL
        : SwingAngle.HORIZONTAL;

    this.device.attributes.TEMP_FAHRENHEIT = this.configDev.AC_options.fahrenheit;

    this.heatingThresholdTemperature = limitValue(
      this.accessory.context?.thresholds?.heatingTemperature ?? this.configDev.AC_options.minTemp,
      this.configDev.AC_options.minTemp,
      this.configDev.AC_options.maxTemp,
    );
    this.coolingThresholdTemperature = limitValue(
      this.accessory.context?.thresholds?.coolingTemperature ?? this.configDev.AC_options.maxTemp,
      this.configDev.AC_options.minTemp,
      this.configDev.AC_options.maxTemp,
    );

    // Remove old service if switching between service types
    const oldService = this.useThermostat
      ? this.accessory.getService(this.platform.Service.HeaterCooler)
      : this.accessory.getService(this.platform.Service.Thermostat);
    if (oldService) {
      this.accessory.removeService(oldService);
    }

    // Create the appropriate service
    this.service = this.useThermostat
      ? this.accessory.getService(this.platform.Service.Thermostat) || this.accessory.addService(this.platform.Service.Thermostat)
      : this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);

    this.handleConfiguredName(this.service, 'main', this.device.name);

    // Temperature display units — shared by both service types
    this.service
      .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      ?.setValue(this.getTemperatureDisplayUnits())
      ?.onGet(this.getTemperatureDisplayUnits.bind(this))
      ?.onSet(this.setTemperatureDisplayUnits.bind(this));

    // Current temperature — shared by both service types
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)?.onGet(this.getCurrentTemperature.bind(this));

    // Current relative humidity - for Thermostat
    if (this.useThermostat) {
      this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)?.onGet(this.getIndoorHumidity.bind(this));
    }

    // Filter change indication — shared by both service types
    this.service.getCharacteristic(this.platform.Characteristic.FilterChangeIndication)?.onGet(this.getFilterChangeIndication.bind(this));

    // Service-specific characteristic registration
    this.service
      .getCharacteristic(this.useThermostat ? this.platform.Characteristic.CurrentHeatingCoolingState : this.platform.Characteristic.CurrentHeaterCoolerState)
      ?.onGet(this.getCurrentState.bind(this));

    const thermostatStateValues = this.configDev.AC_options.heatingCapable
      ? [
          this.platform.Characteristic.TargetHeatingCoolingState.OFF,
          this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
          this.platform.Characteristic.TargetHeatingCoolingState.COOL,
          this.platform.Characteristic.TargetHeatingCoolingState.AUTO,
        ]
      : [
          this.platform.Characteristic.TargetHeatingCoolingState.OFF,
          this.platform.Characteristic.TargetHeatingCoolingState.COOL,
          this.platform.Characteristic.TargetHeatingCoolingState.AUTO,
        ];

    const heaterCoolerStateValues = this.configDev.AC_options.heatingCapable
      ? [
          this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
          this.platform.Characteristic.TargetHeaterCoolerState.HEAT,
          this.platform.Characteristic.TargetHeaterCoolerState.COOL,
        ]
      : [this.platform.Characteristic.TargetHeaterCoolerState.AUTO, this.platform.Characteristic.TargetHeaterCoolerState.COOL];

    this.service
      .getCharacteristic(this.useThermostat ? this.platform.Characteristic.TargetHeatingCoolingState : this.platform.Characteristic.TargetHeaterCoolerState)
      ?.onGet(this.getTargetState.bind(this))
      ?.onSet(this.setTargetState.bind(this))
      ?.setProps({
        validValues: this.useThermostat ? thermostatStateValues : heaterCoolerStateValues,
      });

    if (this.useThermostat) {
      this.service
        .getCharacteristic(this.platform.Characteristic.TargetTemperature)
        ?.setProps({
          minValue: this.configDev.AC_options.minTemp,
          maxValue: this.configDev.AC_options.maxTemp,
          minStep: this.configDev.AC_options.tempStep,
        })
        ?.onGet(this.getTargetTemperature.bind(this))
        ?.onSet(this.setTargetTemperature.bind(this));
    } else {
      this.service.getCharacteristic(this.platform.Characteristic.Active)?.onGet(this.getActive.bind(this))?.onSet(this.setActive.bind(this));

      this.service
        .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
        ?.setProps({
          minValue: this.configDev.AC_options.minTemp,
          maxValue: this.configDev.AC_options.maxTemp,
          minStep: this.configDev.AC_options.tempStep,
        })
        ?.setValue(this.getCoolingThresholdTemperature())
        ?.onGet(this.getCoolingThresholdTemperature.bind(this))
        ?.onSet(this.setCoolingThresholdTemperature.bind(this));

      this.service
        .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
        ?.setProps({
          minValue: this.configDev.AC_options.minTemp,
          maxValue: this.configDev.AC_options.maxTemp,
          minStep: this.configDev.AC_options.tempStep,
        })
        ?.setValue(this.getHeatingThresholdTemperature())
        ?.onGet(this.getHeatingThresholdTemperature.bind(this))
        ?.onSet(this.setHeatingThresholdTemperature.bind(this));
    }

    // Common Fan Control for both service types (Thermostat and HeaterCooler)
    // This improves compatibility with Android/Google Home via Matter/Bridges
    const fanSpeedSteps = this.getFanSpeedSteps();
    const rotationSpeedCharacteristic = this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed);
    if (rotationSpeedCharacteristic) {
      rotationSpeedCharacteristic
        .setProps({
          minValue: 0,
          maxValue: 100,
          minStep: 1,
          ...(fanSpeedSteps.length > 0 && { validValues: fanSpeedSteps.filter((v) => v <= 100) }),
        })
        .setValue(this.getRotationSpeed())
        .onGet(this.getRotationSpeed.bind(this))
        .onSet(this.setRotationSpeed.bind(this));
    }

    // Swing modes (HeaterCooler only — Thermostat uses the fan accessory for swing)
    if (!this.useThermostat && this.configDev.AC_options.swing.mode !== SwingMode.NONE) {
      this.service.getCharacteristic(this.platform.Characteristic.SwingMode)?.onGet(this.getSwingMode.bind(this)).onSet(this.setSwingMode.bind(this));
    }

    // Outdoor temperature sensor
    this.outDoorTemperatureService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, outDoorTemperatureSubtype);
    if (this.configDev.AC_options.outDoorTemp) {
      this.outDoorTemperatureService ??= this.accessory.addService(this.platform.Service.TemperatureSensor, undefined, outDoorTemperatureSubtype);
      this.handleConfiguredName(this.outDoorTemperatureService, outDoorTemperatureSubtype, 'Outdoor', this.configDev.AC_options.outDoorTempName);
      this.service.addLinkedService(this.outDoorTemperatureService);
      this.outDoorTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)?.onGet(this.getOutdoorTemperature.bind(this));
      this.outDoorTemperatureService
        .getCharacteristic(this.platform.Characteristic.StatusFault)
        ?.onGet(() =>
          this.device.attributes.OUTDOOR_TEMPERATURE === undefined
            ? this.platform.Characteristic.StatusFault.GENERAL_FAULT
            : this.platform.Characteristic.StatusFault.NO_FAULT,
        );
    } else if (this.outDoorTemperatureService) {
      this.accessory.removeService(this.outDoorTemperatureService);
    }

    // Fan-only mode switch
    this.fanOnlyService = this.accessory.getServiceById(this.platform.Service.Switch, fanOnlySubtype);
    if (this.configDev.AC_options.fanOnlyModeSwitch) {
      this.fanOnlyService ??= this.accessory.addService(this.platform.Service.Switch, undefined, fanOnlySubtype);
      this.handleConfiguredName(this.fanOnlyService, fanOnlySubtype, 'Mode: Fan', this.configDev.AC_options.fanOnlyModeSwitchName);
      this.service.addLinkedService(this.fanOnlyService);
      this.fanOnlyService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getFanOnlyMode.bind(this)).onSet(this.setFanOnlyMode.bind(this));
    } else if (this.fanOnlyService) {
      this.accessory.removeService(this.fanOnlyService);
    }

    // Fan accessory
    this.fanService = this.accessory.getServiceById(this.platform.Service.Fanv2, fanSubtype);
    if (this.configDev.AC_options.fanAccessory) {
      this.fanService ??= this.accessory.addService(this.platform.Service.Fanv2, undefined, fanSubtype);
      this.handleConfiguredName(this.fanService, fanSubtype, 'Fan', this.configDev.AC_options.fanAccessoryName);
      this.service.addLinkedService(this.fanService);
      this.fanService.getCharacteristic(this.platform.Characteristic.Active)?.onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));

      const fanRotationSpeedCharacteristic = this.fanService.getCharacteristic(this.platform.Characteristic.RotationSpeed);
      if (fanRotationSpeedCharacteristic) {
        fanRotationSpeedCharacteristic.setProps({
          minValue: 0,
          maxValue: 100,
          minStep: 1,
          ...(fanSpeedSteps.length > 0 && { validValues: fanSpeedSteps.filter((v) => v <= 100) }),
        });
        fanRotationSpeedCharacteristic.onGet(this.getRotationSpeed.bind(this)).onSet(this.setRotationSpeed.bind(this));
      }

      this.fanService.getCharacteristic(this.platform.Characteristic.TargetFanState)?.onGet(this.getFanState.bind(this)).onSet(this.setFanState.bind(this));
      this.fanService.getCharacteristic(this.platform.Characteristic.SwingMode)?.onGet(this.getSwingMode.bind(this)).onSet(this.setSwingMode.bind(this));
    } else if (this.fanService) {
      this.accessory.removeService(this.fanService);
    }

    // Fan Auto switch
    this.fanAutoService = this.accessory.getServiceById(this.platform.Service.Switch, fanAutoSubtype);
    if (this.configDev.AC_options.fanAutoSwitch) {
      this.fanAutoService ??= this.accessory.addService(this.platform.Service.Switch, undefined, fanAutoSubtype);
      this.handleConfiguredName(this.fanAutoService, fanAutoSubtype, 'Fan Auto', this.configDev.AC_options.fanAutoSwitchName);
      this.service.addLinkedService(this.fanAutoService);
      this.fanAutoService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getFanState.bind(this)).onSet(this.setFanAuto.bind(this));
    } else if (this.fanAutoService) {
      this.accessory.removeService(this.fanAutoService);
    }

    // Display switch
    this.displayService = this.accessory.getServiceById(this.platform.Service.Switch, displaySubtype);
    if (this.configDev.AC_options.displaySwitch) {
      this.device.set_alternate_switch_display(this.configDev.AC_options.displaySwitchAlternate);
      this.displayService ??= this.accessory.addService(this.platform.Service.Switch, undefined, displaySubtype);
      this.handleConfiguredName(this.displayService, displaySubtype, 'Display', this.configDev.AC_options.displaySwitchName);
      this.service.addLinkedService(this.displayService);
      this.displayService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getDisplayActive.bind(this)).onSet(this.setDisplayActive.bind(this));
    } else if (this.displayService) {
      this.accessory.removeService(this.displayService);
    }

    // Eco mode switch
    this.ecoModeService = this.accessory.getServiceById(this.platform.Service.Switch, ecoModeSubtype);
    if (this.configDev.AC_options.ecoSwitch) {
      this.ecoModeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, ecoModeSubtype);
      this.handleConfiguredName(this.ecoModeService, ecoModeSubtype, 'Eco', this.configDev.AC_options.ecoSwitchName);
      this.service.addLinkedService(this.ecoModeService);
      this.ecoModeService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getEcoMode.bind(this)).onSet(this.setEcoMode.bind(this));
    } else if (this.ecoModeService) {
      this.accessory.removeService(this.ecoModeService);
    }

    // Cool mode switch
    this.coolModeService = this.accessory.getServiceById(this.platform.Service.Switch, coolModeSubtype);
    if (this.configDev.AC_options.coolModeSwitch) {
      this.coolModeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, coolModeSubtype);
      this.handleConfiguredName(this.coolModeService, coolModeSubtype, 'Mode: Cool', this.configDev.AC_options.coolModeSwitchName);
      this.service.addLinkedService(this.coolModeService);
      this.coolModeService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getCoolMode.bind(this)).onSet(this.setCoolMode.bind(this));
    } else if (this.coolModeService) {
      this.accessory.removeService(this.coolModeService);
    }

    // Heat mode switch
    this.heatModeService = this.accessory.getServiceById(this.platform.Service.Switch, heatModeSubtype);
    if (this.configDev.AC_options.heatModeSwitch) {
      this.heatModeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, heatModeSubtype);
      this.handleConfiguredName(this.heatModeService, heatModeSubtype, 'Mode: Heat', this.configDev.AC_options.heatModeSwitchName);
      this.service.addLinkedService(this.heatModeService);
      this.heatModeService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getHeatMode.bind(this)).onSet(this.setHeatMode.bind(this));
    } else if (this.heatModeService) {
      this.accessory.removeService(this.heatModeService);
    }

    // Auto mode switch
    this.autoModeService = this.accessory.getServiceById(this.platform.Service.Switch, autoModeSubtype);
    if (this.configDev.AC_options.autoModeSwitch) {
      this.autoModeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, autoModeSubtype);
      this.handleConfiguredName(this.autoModeService, autoModeSubtype, 'Mode: Auto', this.configDev.AC_options.autoModeSwitchName);
      this.service.addLinkedService(this.autoModeService);
      this.autoModeService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getAutoMode.bind(this)).onSet(this.setAutoMode.bind(this));
    } else if (this.autoModeService) {
      this.accessory.removeService(this.autoModeService);
    }

    // Breeze away switch
    this.breezeAwayService = this.accessory.getServiceById(this.platform.Service.Switch, breezeAwaySubtype);
    if (this.configDev.AC_options.breezeAwaySwitch) {
      this.breezeAwayService ??= this.accessory.addService(this.platform.Service.Switch, undefined, breezeAwaySubtype);
      this.handleConfiguredName(this.breezeAwayService, breezeAwaySubtype, 'Breeze', this.configDev.AC_options.breezeAwaySwitchName);
      this.breezeAwayService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getBreezeAway.bind(this)).onSet(this.setBreezeAway.bind(this));
    } else if (this.breezeAwayService) {
      this.accessory.removeService(this.breezeAwayService);
    }

    // Dry mode switch
    this.dryModeService = this.accessory.getServiceById(this.platform.Service.Switch, dryModeSubtype);
    if (this.configDev.AC_options.dryModeSwitch) {
      this.dryModeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, dryModeSubtype);
      this.handleConfiguredName(this.dryModeService, dryModeSubtype, 'Mode: Dry', this.configDev.AC_options.dryModeSwitchName);
      this.service.addLinkedService(this.dryModeService);
      this.dryModeService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getDryMode.bind(this)).onSet(this.setDryMode.bind(this));
    } else if (this.dryModeService) {
      this.accessory.removeService(this.dryModeService);
    }

    // Boost mode switch
    this.boostModeService = this.accessory.getServiceById(this.platform.Service.Switch, boostModeSubtype);
    if (this.configDev.AC_options.boostModeSwitch) {
      this.boostModeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, boostModeSubtype);
      this.handleConfiguredName(this.boostModeService, boostModeSubtype, 'Boost', this.configDev.AC_options.boostModeSwitchName);
      this.service.addLinkedService(this.boostModeService);
      this.boostModeService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getBoostMode.bind(this)).onSet(this.setBoostMode.bind(this));
    } else if (this.boostModeService) {
      this.accessory.removeService(this.boostModeService);
    }

    // Aux switch
    this.auxService = this.accessory.getServiceById(this.platform.Service.Switch, auxSubtype);
    if (this.configDev.AC_options.auxHeatingSwitches) {
      this.auxService ??= this.accessory.addService(this.platform.Service.Switch, undefined, auxSubtype);
      this.handleConfiguredName(this.auxService, auxSubtype, 'Aux', this.configDev.AC_options.auxHeatingSwitchesName);
      this.auxService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getAux.bind(this)).onSet(this.setAux.bind(this));
    } else if (this.auxService) {
      this.accessory.removeService(this.auxService);
    }

    // Aux+Heat switch
    this.auxHeatingService = this.accessory.getServiceById(this.platform.Service.Switch, auxHeatingSubtype);
    if (this.configDev.AC_options.auxHeatingSwitches) {
      this.auxHeatingService ??= this.accessory.addService(this.platform.Service.Switch, undefined, auxHeatingSubtype);
      this.handleConfiguredName(this.auxHeatingService, auxHeatingSubtype, 'Aux+Heat', this.configDev.AC_options.auxHeatingSwitchesPlusHeatName);
      this.auxHeatingService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getAuxHeating.bind(this)).onSet(this.setAuxHeating.bind(this));
    } else if (this.auxHeatingService) {
      this.accessory.removeService(this.auxHeatingService);
    }

    // Self-cleaning switch
    this.selfCleanService = this.accessory.getServiceById(this.platform.Service.Switch, selfCleanSubtype);
    if (this.configDev.AC_options.selfCleanSwitch) {
      this.selfCleanService ??= this.accessory.addService(this.platform.Service.Switch, undefined, selfCleanSubtype);
      this.handleConfiguredName(this.selfCleanService, selfCleanSubtype, 'Mode: Auto Clean', this.configDev.AC_options.selfCleanSwitchName);
      this.service.addLinkedService(this.selfCleanService);
      this.selfCleanService
        .getCharacteristic(this.platform.Characteristic.On)
        ?.onGet(this.getSelfCleanState.bind(this))
        .onSet(this.setSelfCleanState.bind(this));
    } else if (this.selfCleanService) {
      this.accessory.removeService(this.selfCleanService);
    }

    // ION switch
    this.ionService = this.accessory.getServiceById(this.platform.Service.Switch, ionSubtype);
    if (this.configDev.AC_options.ionSwitch) {
      this.ionService ??= this.accessory.addService(this.platform.Service.Switch, undefined, ionSubtype);
      this.handleConfiguredName(this.ionService, ionSubtype, 'ION', this.configDev.AC_options.ionSwitchName);
      this.service.addLinkedService(this.ionService);
      this.ionService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getIonState.bind(this)).onSet(this.setIonState.bind(this));
    } else if (this.ionService) {
      this.accessory.removeService(this.ionService);
    }

    // Out Silent Mode switch
    this.outSilentService = this.accessory.getServiceById(this.platform.Service.Switch, outSilentSubtype);
    if (this.configDev.AC_options.outSilentSwitch) {
      this.outSilentService ??= this.accessory.addService(this.platform.Service.Switch, undefined, outSilentSubtype);
      this.handleConfiguredName(this.outSilentService, outSilentSubtype, 'Out Silent', this.configDev.AC_options.outSilentSwitchName);
      this.outSilentService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getOutSilent.bind(this)).onSet(this.setOutSilent.bind(this));
    } else if (this.outSilentService) {
      this.accessory.removeService(this.outSilentService);
    }

    // Rate select slider
    this.rateSelectService = this.accessory.getServiceById(this.platform.Service.Lightbulb, rateSelectSubtype);
    if (this.configDev.AC_options.rateSelector) {
      this.rateSelectService ??= this.accessory.addService(this.platform.Service.Lightbulb, undefined, rateSelectSubtype);
      this.handleConfiguredName(this.rateSelectService, rateSelectSubtype, 'Gear', this.configDev.AC_options.rateSelectorName);
      this.service.addLinkedService(this.rateSelectService);
      this.rateSelectService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getRateSelectOn.bind(this))?.onSet(this.setRateSelectOn.bind(this));
      this.rateSelectService
        .getCharacteristic(this.platform.Characteristic.Brightness)
        ?.setProps({
          minValue: 0,
          maxValue: 100,
          minStep: 1,
        })
        ?.onGet(this.getRateSelect.bind(this))
        ?.onSet(this.setRateSelect.bind(this));
    } else if (this.rateSelectService) {
      this.accessory.removeService(this.rateSelectService);
    }

    // Sleep mode accessory
    this.sleepModeService = this.accessory.getServiceById(this.platform.Service.Switch, sleepModeSubtype);
    if (this.configDev.AC_options.sleepModeSwitch) {
      this.sleepModeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, sleepModeSubtype);
      this.handleConfiguredName(this.sleepModeService, sleepModeSubtype, 'Sleep', this.configDev.AC_options.sleepModeSwitchName);
      this.service.addLinkedService(this.sleepModeService);
      this.sleepModeService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getSleepMode.bind(this)).onSet(this.setSleepMode.bind(this));
    } else if (this.sleepModeService) {
      this.accessory.removeService(this.sleepModeService);
    }

    // Comfort mode accessory
    this.comfortModeService = this.accessory.getServiceById(this.platform.Service.Switch, comfortModeSubtype);
    if (this.configDev.AC_options.comfortModeSwitch) {
      this.comfortModeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, comfortModeSubtype);
      this.handleConfiguredName(this.comfortModeService, comfortModeSubtype, 'Comfort', this.configDev.AC_options.comfortModeSwitchName);
      this.comfortModeService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getComfortMode.bind(this)).onSet(this.setComfortMode.bind(this));
    } else if (this.comfortModeService) {
      this.accessory.removeService(this.comfortModeService);
    }

    // Separate temperature sensor accessory
    this.temperatureSensorService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, temperatureSensorSubtype);
    if (this.configDev.AC_options.temperatureSensor) {
      this.temperatureSensorService ??= this.accessory.addService(this.platform.Service.TemperatureSensor, undefined, temperatureSensorSubtype);
      this.handleConfiguredName(this.temperatureSensorService, temperatureSensorSubtype, 'Indoor Temperature', this.configDev.AC_options.temperatureSensorName);
      this.service.addLinkedService(this.temperatureSensorService);
      this.temperatureSensorService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)?.onGet(this.getCurrentTemperature.bind(this));
    } else if (this.temperatureSensorService) {
      this.accessory.removeService(this.temperatureSensorService);
    }

    // Separate humidity sensor accessory
    this.humiditySensorService = this.accessory.getServiceById(this.platform.Service.HumiditySensor, humiditySensorSubtype);
    if (this.configDev.AC_options.humiditySensor) {
      this.humiditySensorService ??= this.accessory.addService(this.platform.Service.HumiditySensor, undefined, humiditySensorSubtype);
      this.handleConfiguredName(this.humiditySensorService, humiditySensorSubtype, 'Humidity', this.configDev.AC_options.humiditySensorName);
      this.service.addLinkedService(this.humiditySensorService);
      this.humiditySensorService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)?.onGet(this.getIndoorHumidity.bind(this));
    } else if (this.humiditySensorService) {
      this.accessory.removeService(this.humiditySensorService);
    }

    // Smart Eye switch
    this.smartEyeService = this.accessory.getServiceById(this.platform.Service.Switch, smartEyeSubtype);
    if (this.configDev.AC_options.smartEyeSwitch) {
      this.smartEyeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, smartEyeSubtype);
      this.handleConfiguredName(this.smartEyeService, smartEyeSubtype, 'iSense', this.configDev.AC_options.smartEyeSwitchName);
      this.service.addLinkedService(this.smartEyeService);
      this.smartEyeService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getSmartEye.bind(this)).onSet(this.setSmartEye.bind(this));
    } else if (this.smartEyeService) {
      this.accessory.removeService(this.smartEyeService);
    }

    // Audio Feedback switch
    this.audioFeedbackService = this.accessory.getServiceById(this.platform.Service.Switch, audioFeedbackSubtype);
    if (this.configDev.AC_options.audioFeedbackSwitch) {
      this.audioFeedbackService ??= this.accessory.addService(this.platform.Service.Switch, undefined, audioFeedbackSubtype);
      this.handleConfiguredName(this.audioFeedbackService, audioFeedbackSubtype, 'Sound', this.configDev.AC_options.audioFeedbackSwitchName);
      this.service.addLinkedService(this.audioFeedbackService);
      this.audioFeedbackService
        .getCharacteristic(this.platform.Characteristic.On)
        ?.onGet(this.getAudioFeedback.bind(this))
        .onSet(this.setAudioFeedback.bind(this));
    } else if (this.audioFeedbackService) {
      this.accessory.removeService(this.audioFeedbackService);
    }

    // Timer switch
    this.timerService = this.accessory.getServiceById(this.platform.Service.Valve, timerSubtype);
    if (this.configDev.AC_options.timerSwitch) {
      this.timerService ??= this.accessory.addService(this.platform.Service.Valve, undefined, timerSubtype);
      this.handleConfiguredName(this.timerService, timerSubtype, 'Timer', this.configDev.AC_options.timerSwitchName);
      this.service.addLinkedService(this.timerService);
      this.timerService.getCharacteristic(this.platform.Characteristic.Active)?.onGet(this.getTimerActive.bind(this)).onSet(this.setTimerActive.bind(this));
      this.timerService.getCharacteristic(this.platform.Characteristic.InUse)?.onGet(this.getTimerActive.bind(this));
      this.timerService.getCharacteristic(this.platform.Characteristic.ValveType)?.onGet(() => this.platform.Characteristic.ValveType.GENERIC_VALVE);
      this.timerService.getCharacteristic(this.platform.Characteristic.SetDuration).onSet(this.setTimerDuration.bind(this));
      this.timerService.getCharacteristic(this.platform.Characteristic.RemainingDuration)?.onGet(this.getTimerRemainingDuration.bind(this));
    } else if (this.timerService) {
      this.accessory.removeService(this.timerService);
    }

    // Power Meter service (Outlet)
    this.powerMeterService = this.accessory.getServiceById(this.platform.Service.Outlet, powerMeterSubtype);
    if (this.configDev.AC_options.powerMeter) {
      this.powerMeterService ??= this.accessory.addService(this.platform.Service.Outlet, undefined, powerMeterSubtype);
      this.handleConfiguredName(this.powerMeterService, powerMeterSubtype, 'Consumption', this.configDev.AC_options.powerMeterName);
      this.service.addLinkedService(this.powerMeterService);

      this.powerMeterService.getCharacteristic(this.platform.Characteristic.On)?.onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));

      this.powerMeterService.getCharacteristic(this.platform.Characteristic.OutletInUse)?.onGet(this.getActive.bind(this));

      // Eve Power
      if (!this.powerMeterService.characteristics.some((c) => c.UUID === EVE_POWER_UUID)) {
        try {
          this.powerMeterService.addCharacteristic(
            new this.platform.api.hap.Characteristic('Power', EVE_POWER_UUID, {
              format: this.platform.api.hap.Formats.FLOAT,
              unit: 'W',
              perms: [this.platform.api.hap.Perms.PAIRED_READ, this.platform.api.hap.Perms.NOTIFY],
            }),
          );
        } catch (error) {
          this.platform.log.debug(`[${this.device.name}] Eve Power characteristic already exists: ${error}`);
        }
      }
      this.powerMeterService.getCharacteristic(EVE_POWER_UUID as any)?.onGet(this.getRealtimePower.bind(this));

      // Eve Total Consumption
      if (!this.powerMeterService.characteristics.some((c) => c.UUID === EVE_ENERGY_UUID)) {
        try {
          this.powerMeterService.addCharacteristic(
            new this.platform.api.hap.Characteristic('Total Consumption', EVE_ENERGY_UUID, {
              format: this.platform.api.hap.Formats.FLOAT,
              unit: 'kWh',
              perms: [this.platform.api.hap.Perms.PAIRED_READ, this.platform.api.hap.Perms.NOTIFY],
            }),
          );
        } catch (error) {
          this.platform.log.debug(`[${this.device.name}] Eve Total Consumption characteristic already exists: ${error}`);
        }
      }
      this.powerMeterService.getCharacteristic(EVE_ENERGY_UUID as any)?.onGet(this.getTotalEnergyConsumption.bind(this));
    } else if (this.powerMeterService) {
      this.accessory.removeService(this.powerMeterService);
    }

    // Power Watts service (workaround for native Home app visibility)
    const currentPowerService = this.accessory.services.find((s) => s.subtype === powerWattsSubtype);
    const targetPowerServiceType = this.getDisplayServiceType(this.configDev.AC_options.powerDisplayType);
    if (currentPowerService && (currentPowerService.UUID !== targetPowerServiceType.UUID || this.configDev.AC_options.powerDisplayType === 'None')) {
      this.platform.log.info(
        `[${this.device.name}] Removing old power display service (${currentPowerService.UUID === this.platform.Service.LightSensor.UUID ? 'Lux' : 'Other'})`,
      );
      this.accessory.removeService(currentPowerService);
      this.powerWattsService = undefined;
    } else {
      this.powerWattsService = currentPowerService;
    }

    if (this.configDev.AC_options.powerMeter && this.configDev.AC_options.powerDisplayType !== 'None') {
      this.powerWattsService ??= this.accessory.addService(targetPowerServiceType, undefined, powerWattsSubtype);
      this.handleConfiguredName(
        this.powerWattsService,
        powerWattsSubtype,
        `Power (${this.getDisplayUnit(this.configDev.AC_options.powerDisplayType)})`,
        this.configDev.AC_options.powerMeterName ? `${this.configDev.AC_options.powerMeterName} Watts` : undefined,
      );
      this.service.addLinkedService(this.powerWattsService);
      this.powerWattsService
        .getCharacteristic(this.getDisplayCharacteristic(this.configDev.AC_options.powerDisplayType))
        ?.onGet(this.getRealtimePower.bind(this));
      if (this.configDev.AC_options.powerDisplayType === 'CarbonDioxide') {
        this.powerWattsService
          .getCharacteristic(this.platform.Characteristic.CarbonDioxideDetected)
          ?.onGet(() => this.platform.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL);
      }
    }

    // Energy kWh service (workaround for native Home app visibility)
    const currentEnergyService = this.accessory.services.find((s) => s.subtype === energykWhSubtype);
    const targetEnergyServiceType = this.getDisplayServiceType(this.configDev.AC_options.energyDisplayType);
    if (currentEnergyService && (currentEnergyService.UUID !== targetEnergyServiceType.UUID || this.configDev.AC_options.energyDisplayType === 'None')) {
      this.platform.log.info(
        `[${this.device.name}] Removing old energy display service (${currentEnergyService.UUID === this.platform.Service.LightSensor.UUID ? 'Lux' : 'Other'})`,
      );
      this.accessory.removeService(currentEnergyService);
      this.energykWhService = undefined;
    } else {
      this.energykWhService = currentEnergyService;
    }

    if (this.configDev.AC_options.powerMeter && this.configDev.AC_options.energyDisplayType !== 'None') {
      this.energykWhService ??= this.accessory.addService(targetEnergyServiceType, undefined, energykWhSubtype);
      this.handleConfiguredName(
        this.energykWhService,
        energykWhSubtype,
        `Energy (${this.getDisplayUnit(this.configDev.AC_options.energyDisplayType)})`,
        this.configDev.AC_options.powerMeterName ? `${this.configDev.AC_options.powerMeterName} Energy` : undefined,
      );
      this.service.addLinkedService(this.energykWhService);
      this.energykWhService
        .getCharacteristic(this.getDisplayCharacteristic(this.configDev.AC_options.energyDisplayType))
        ?.onGet(this.getTotalEnergyConsumption.bind(this));
      if (this.configDev.AC_options.energyDisplayType === 'CarbonDioxide') {
        this.energykWhService
          .getCharacteristic(this.platform.Characteristic.CarbonDioxideDetected)
          ?.onGet(() => this.platform.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL);
      }
    }

    // Swing angle accessory
    this.swingAngleService = this.accessory.getServiceById(this.platform.Service.WindowCovering, swingAngleSubtype);
    if (this.configDev.AC_options.swing.mode !== SwingMode.NONE && this.configDev.AC_options.swing.angleAccessory) {
      this.swingAngleService ??= this.accessory.addService(this.platform.Service.WindowCovering, undefined, swingAngleSubtype);
      this.handleConfiguredName(this.swingAngleService, swingAngleSubtype, 'Swing', this.configDev.AC_options.swing.angleAccessoryName);
      this.swingAngleService.getCharacteristic(this.platform.Characteristic.CurrentPosition)?.onGet(this.getSwingAngleCurrentPosition.bind(this));
      this.swingAngleService
        .getCharacteristic(this.platform.Characteristic.TargetPosition)
        ?.onGet(this.getSwingAngleTargetPosition.bind(this))
        .onSet(this.setSwingAngleTargetPosition.bind(this));
      this.swingAngleService.getCharacteristic(this.platform.Characteristic.PositionState)?.onGet(this.getSwingAnglePositionState.bind(this));

      if (this.configDev.AC_options.swing.mode === SwingMode.BOTH) {
        this.swingAngleService
          .getCharacteristic(this.platform.Characteristic.CurrentHorizontalTiltAngle)
          ?.onGet(this.getSwingAngleCurrentHorizontalTiltAngle.bind(this));
        this.swingAngleService
          .getCharacteristic(this.platform.Characteristic.TargetHorizontalTiltAngle)
          ?.onGet(this.getSwingAngleTargetHorizontalTiltAngle.bind(this))
          .onSet(this.setSwingAngleTargetHorizontalTiltAngle.bind(this));
        this.swingAngleService
          .getCharacteristic(this.platform.Characteristic.CurrentVerticalTiltAngle)
          ?.onGet(this.getSwingAngleCurrentVerticalTiltAngle.bind(this));
        this.swingAngleService
          .getCharacteristic(this.platform.Characteristic.TargetVerticalTiltAngle)
          ?.onGet(this.getSwingAngleTargetVerticalTiltAngle.bind(this))
          .onSet(this.setSwingAngleTargetVerticalTiltAngle.bind(this));
      }
    } else if (this.swingAngleService) {
      this.accessory.removeService(this.swingAngleService);
    }
    // Misc
    this.initialized = true;

    // Eve History
    if (this.configDev.AC_options.powerMeter) {
      const FakeGatoHistoryService = FakegatoHistory(this.platform.api);
      this.historyService = new FakeGatoHistoryService('energy', this.accessory, {
        storage: 'fs',
        log: this.platform.log,
      });
    }

    // Weather Service updates
    this.platform.weatherService.on('update', (data) => {
      if (this.configDev.AC_options.humidityWeatherFallback) {
        this.platform.log.info(`[${this.device.name}] Weather service updated (${data.humidity}%), refreshing humidity characteristic.`);
        const humidity = this.getIndoorHumidity();
        if (this.humiditySensorService) {
          this.platform.log.info(
            `[${this.device.name}] Updating HumiditySensor service (iid: ${this.humiditySensorService.iid}) characteristic to ${humidity}%`,
          );
          this.humiditySensorService.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humidity);
        } else {
          this.platform.log.warn(`[${this.device.name}] Humidity fallback enabled but Humidity Sensor service is not enabled in config.`);
        }
        if (this.useThermostat) {
          this.platform.log.info(`[${this.device.name}] Updating Thermostat service (iid: ${this.service.iid}) characteristic to ${humidity}%`);
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humidity);
        }
        this.historyService?.addEntry({ time: Math.round(new Date().getTime() / 1000), humidity: humidity as number });
      }
    });

    // Initial weather fallback check
    if (this.configDev.AC_options.humidityWeatherFallback) {
      this.platform.log.info(`[${this.device.name}] Humidity weather fallback enabled.`);
      if (this.platform.weatherService.humidity !== undefined) {
        const humidity = this.getIndoorHumidity();
        this.platform.log.info(`[${this.device.name}] Using initial weather fallback humidity: ${humidity}%`);
        this.humiditySensorService?.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humidity);
        if (this.useThermostat) {
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humidity);
        }
      } else {
        this.platform.log.info(`[${this.device.name}] Humidity weather fallback enabled, waiting for first weather update.`);
      }
    } else if (this.platform.platformConfig.weather.enabled && this.configDev.AC_options.humiditySensor) {
      this.platform.log.info(
        `[${this.device.name}] Tip: Global Weather Service is enabled. To use it as a fallback for this device, enable "Humidity Weather Fallback" in this device's settings.`,
      );
    }
  }

  private async withoutPromptTone<T>(fn: () => Promise<T>): Promise<T> {
    const hadPromptTone = this.device.attributes.PROMPT_TONE;
    this.device.attributes.PROMPT_TONE = false;

    try {
      return await fn();
    } finally {
      this.device.attributes.PROMPT_TONE = hadPromptTone;
    }
  }

  /*********************************************************************
   * Callback function called by MideaDevice whenever there is a change to
   * any attribute value.
   */
  protected async updateCharacteristics(attributes: Partial<ACAttributes>) {
    let historyEntry: any = {};
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      let updateState = false;
      switch (k.toLowerCase()) {
        case 'power':
          updateState = true;
          break;
        case 'temp_fahrenheit':
          this.service?.updateCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits, this.getTemperatureDisplayUnits());
          break;
        case 'screen_display':
        case 'screen_display_new':
          this.displayService?.updateCharacteristic(this.platform.Characteristic.On, this.getDisplayActive());
          break;
        case 'target_temperature': {
          const target = Number(this.getTargetTemperature());
          if (this.useThermostat) {
            this.service?.updateCharacteristic(this.platform.Characteristic.TargetTemperature, target);
          } else {
            if (this.device.attributes.MODE === ACMode.HEATING) {
              this.setHeatingCoolingTemperatureThresholds({ heating: target });
            } else if (this.device.attributes.MODE === ACMode.COOLING) {
              this.setHeatingCoolingTemperatureThresholds({ cooling: target });
            } else if (target < this.heatingThresholdTemperature || target > this.coolingThresholdTemperature) {
              this.setHeatingCoolingTemperatureThresholds({ heating: target, cooling: target });
            }
          }
          updateState = true;
          break;
        }
        case 'indoor_temperature': {
          const temperature = this.getCurrentTemperature();
          this.service?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temperature);
          this.temperatureSensorService?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temperature);
          historyEntry.temp = temperature as number;
          if (!this.useThermostat && this.device.attributes.POWER && this.device.attributes.MODE === ACMode.AUTO) {
            await this.withoutPromptTone(this.setTargetTemperatureWithinThresholds.bind(this));
            updateState = true;
          }
          break;
        }
        case 'indoor_humidity':
          this.humiditySensorService?.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.getIndoorHumidity());
          if (this.useThermostat) {
            this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.getIndoorHumidity());
          }
          historyEntry.humidity = this.getIndoorHumidity() as number;
          break;
        case 'realtime_power':
          this.powerMeterService?.getCharacteristic(EVE_POWER_UUID as any)?.updateValue(this.getRealtimePower());
          historyEntry.power = this.getRealtimePower();
          if (this.powerWattsService) {
            const char = this.getDisplayCharacteristic(this.configDev.AC_options.powerDisplayType);
            this.powerWattsService.updateCharacteristic(char, this.getRealtimePower());
            if (this.configDev.AC_options.powerDisplayType === 'CarbonDioxide') {
              this.powerWattsService.updateCharacteristic(
                this.platform.Characteristic.CarbonDioxideDetected,
                this.platform.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL,
              );
            }
          }
          break;
        case 'total_energy_consumption':
          this.powerMeterService?.getCharacteristic(EVE_ENERGY_UUID as any)?.updateValue(this.getTotalEnergyConsumption());
          historyEntry.energy = this.getTotalEnergyConsumption();
          if (this.energykWhService) {
            const char = this.getDisplayCharacteristic(this.configDev.AC_options.energyDisplayType);
            this.energykWhService.updateCharacteristic(char, this.getTotalEnergyConsumption());
            if (this.configDev.AC_options.energyDisplayType === 'CarbonDioxide') {
              this.energykWhService.updateCharacteristic(
                this.platform.Characteristic.CarbonDioxideDetected,
                this.platform.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL,
              );
            }
          }
          break;
        case 'outdoor_temperature':
          this.outDoorTemperatureService?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getOutdoorTemperature());
          break;
        case 'full_dust':
          this.service?.updateCharacteristic(this.platform.Characteristic.FilterChangeIndication, this.getFilterChangeIndication());
          break;
        case 'fan_speed':
          updateState = true;
          break;
        case 'swing_vertical':
        case 'swing_horizontal':
          if (!this.useThermostat) {
            this.service?.updateCharacteristic(this.platform.Characteristic.SwingMode, this.getSwingMode());
          }
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
          this.smartEyeService?.updateCharacteristic(this.platform.Characteristic.On, this.getSmartEye());
          break;
        case 'prompt_tone':
          this.audioFeedbackService?.updateCharacteristic(this.platform.Characteristic.On, this.getAudioFeedback());
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
          this.rateSelectService?.updateCharacteristic(this.platform.Characteristic.On, this.getRateSelectOn());
          break;
        default:
          this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
      }
      if (updateState) {
        this.service?.updateCharacteristic(
          this.useThermostat ? this.platform.Characteristic.CurrentHeatingCoolingState : this.platform.Characteristic.CurrentHeaterCoolerState,
          this.getCurrentState(),
        );
        this.service?.updateCharacteristic(
          this.useThermostat ? this.platform.Characteristic.TargetHeatingCoolingState : this.platform.Characteristic.TargetHeaterCoolerState,
          this.getTargetState(),
        );
        if (!this.useThermostat) {
          this.service?.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
          this.service?.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
        }
        this.fanOnlyService?.updateCharacteristic(this.platform.Characteristic.On, this.getFanOnlyMode());
        this.fanService?.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
        this.fanService?.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
        this.fanService?.updateCharacteristic(this.platform.Characteristic.TargetFanState, this.getFanState());
        this.fanAutoService?.updateCharacteristic(this.platform.Characteristic.On, this.getFanState());
        this.dryModeService?.updateCharacteristic(this.platform.Characteristic.On, this.getDryMode());
        this.displayService?.updateCharacteristic(this.platform.Characteristic.On, this.getDisplayActive());
        this.ecoModeService?.updateCharacteristic(this.platform.Characteristic.On, this.getEcoMode());
        this.breezeAwayService?.updateCharacteristic(this.platform.Characteristic.On, this.getBreezeAway());
        this.auxService?.updateCharacteristic(this.platform.Characteristic.On, this.getAux());
        this.auxHeatingService?.updateCharacteristic(this.platform.Characteristic.On, this.getAuxHeating());
        this.rateSelectService?.updateCharacteristic(this.platform.Characteristic.On, this.getRateSelectOn());
        this.coolModeService?.updateCharacteristic(this.platform.Characteristic.On, this.getCoolMode());
        this.heatModeService?.updateCharacteristic(this.platform.Characteristic.On, this.getHeatMode());
        this.autoModeService?.updateCharacteristic(this.platform.Characteristic.On, this.getAutoMode());
        this.selfCleanService?.updateCharacteristic(this.platform.Characteristic.On, this.getSelfCleanState());
        this.smartEyeService?.updateCharacteristic(this.platform.Characteristic.On, this.getSmartEye());
        this.audioFeedbackService?.updateCharacteristic(this.platform.Characteristic.On, this.getAudioFeedback());
      }
    }

    // Add history entry if any of the monitored attributes changed
    if (Object.keys(historyEntry).length > 0) {
      historyEntry.time = Math.round(new Date().getTime() / 1000);
      this.historyService?.addEntry(historyEntry);
    }
  }

  /*********************************************************************
   * Unified state handlers — branch internally based on service type
   */
  getCurrentState(): CharacteristicValue {
    if (this.useThermostat) {
      if (!this.device.attributes.POWER) {
        return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
      }

      const currentTemp = Number(this.getCurrentTemperature());
      const targetTemp = Number(this.getTargetTemperature());

      if ([ACMode.COOLING, ACMode.AUTO, ACMode.DRY].includes(this.device.attributes.MODE)) {
        if (currentTemp > targetTemp) {
          return this.platform.Characteristic.CurrentHeatingCoolingState.COOL;
        }
      }

      if ([ACMode.HEATING].includes(this.device.attributes.MODE) && this.configDev.AC_options.heatingCapable) {
        if (currentTemp < targetTemp) {
          return this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
        }
      }

      return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    }

    if (!this.device.attributes.POWER || this.device.attributes.MODE === ACMode.OFF) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }

    const isPossiblyCooling = [ACMode.COOLING, ACMode.DRY, ACMode.AUTO].includes(this.device.attributes.MODE);
    const isPossiblyHeating = [ACMode.HEATING, ACMode.AUTO].includes(this.device.attributes.MODE) && this.configDev.AC_options.heatingCapable;

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

  getTargetState(): CharacteristicValue {
    if (this.useThermostat) {
      if (!this.device.attributes.POWER) {
        return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
      }

      switch (this.device.attributes.MODE) {
        case ACMode.COOLING:
        case ACMode.DRY:
          return this.platform.Characteristic.TargetHeatingCoolingState.COOL;
        case ACMode.HEATING:
          return this.platform.Characteristic.TargetHeatingCoolingState.HEAT;
        default:
          return this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
      }
    }

    switch (this.device.attributes.MODE) {
      case ACMode.COOLING:
      case ACMode.DRY:
        return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
      case ACMode.HEATING:
        return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
      default:
        return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }
  }

  async setTargetState(value: CharacteristicValue) {
    if (this.useThermostat) {
      switch (value) {
        case this.platform.Characteristic.TargetHeatingCoolingState.OFF:
          await this.device.set_attribute({ POWER: false });
          break;
        case this.platform.Characteristic.TargetHeatingCoolingState.COOL:
          await this.device.set_attribute({ POWER: true, MODE: ACMode.COOLING });
          break;
        case this.platform.Characteristic.TargetHeatingCoolingState.HEAT:
          await this.device.set_attribute({ POWER: true, MODE: ACMode.HEATING });
          break;
        case this.platform.Characteristic.TargetHeatingCoolingState.AUTO:
          await this.device.set_attribute({ POWER: true, MODE: ACMode.AUTO });
          break;
      }
      return;
    }

    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        await this.device.set_attribute({ POWER: true, MODE: ACMode.AUTO });
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        await this.device.set_attribute({ POWER: true, MODE: ACMode.COOLING });
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        await this.device.set_attribute({ POWER: true, MODE: ACMode.HEATING });
        break;
    }

    await this.setTargetTemperatureWithinThresholds();
  }

  /*********************************************************************
   * Callback functions for each Homebridge/HomeKit service
   */
  getActive(): CharacteristicValue {
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
    await this.device.set_attribute({
      TEMP_FAHRENHEIT: value === this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT,
    });
  }

  getCurrentTemperature(): CharacteristicValue {
    return this.device.attributes.INDOOR_TEMPERATURE ?? this.configDev.AC_options.minTemp;
  }

  getTargetTemperature(): CharacteristicValue {
    const { minTemp, maxTemp } = this.configDev.AC_options;
    return limitValue(this.device.attributes.TARGET_TEMPERATURE, minTemp, maxTemp);
  }

  async setTargetTemperature(value: CharacteristicValue) {
    const { minTemp, maxTemp, tempStep } = this.configDev.AC_options;
    const target = limitValue(Math.round(+value / tempStep) * tempStep, minTemp, maxTemp);

    if (this.getTargetTemperature() === target) return;
    await this.device.set_target_temperature(target);
  }

  async setTargetTemperatureWithinThresholds() {
    if (this.device.attributes.MODE === ACMode.COOLING) {
      await this.setTargetTemperature(this.getCoolingThresholdTemperature());
      return;
    }
    if (this.device.attributes.MODE === ACMode.HEATING) {
      await this.setTargetTemperature(this.getHeatingThresholdTemperature());
      return;
    }

    // For cooling-only units in AUTO mode, treat like COOL
    if (!this.configDev.AC_options.heatingCapable) {
      await this.setTargetTemperature(this.getCoolingThresholdTemperature());
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
    const { minTemp, maxTemp } = this.configDev.AC_options;
    return limitValue(this.coolingThresholdTemperature, minTemp, maxTemp);
  }

  getHeatingThresholdTemperature(): CharacteristicValue {
    const { minTemp, maxTemp } = this.configDev.AC_options;
    return limitValue(this.heatingThresholdTemperature, minTemp, maxTemp);
  }

  getFanOnlyMode(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.MODE === ACMode.FAN_ONLY && !this.device.attributes.SELF_CLEAN;
  }

  async setFanOnlyMode(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, MODE: ACMode.FAN_ONLY });
    } else {
      await this.device.set_attribute({ POWER: false, MODE: ACMode.OFF });
    }
  }

  getFanState(): CharacteristicValue {
    return this.device.attributes.FAN_SPEED === AUTO_FAN_SPEED
      ? this.platform.Characteristic.TargetFanState.AUTO
      : this.platform.Characteristic.TargetFanState.MANUAL;
  }

  async setFanState(value: CharacteristicValue) {
    await this.device.set_fan_auto(value === this.platform.Characteristic.TargetFanState.AUTO);
  }

  async setFanAuto(value: CharacteristicValue) {
    await this.device.set_fan_auto(value === true);
  }

  setHeatingCoolingTemperatureThresholds(thresholds: { heating?: number; cooling?: number }) {
    const { minTemp, maxTemp, tempStep } = this.configDev.AC_options;
    const heating = limitValue(thresholds?.heating ?? this.heatingThresholdTemperature, minTemp, maxTemp);
    const cooling = limitValue(thresholds?.cooling ?? this.coolingThresholdTemperature, minTemp, maxTemp);

    if (heating === this.heatingThresholdTemperature && cooling === this.coolingThresholdTemperature) return;

    this.heatingThresholdTemperature = limitValue(!thresholds?.cooling || heating < cooling ? heating : cooling - tempStep, minTemp, maxTemp);
    this.coolingThresholdTemperature = limitValue(!thresholds?.heating || heating < cooling ? cooling : heating + tempStep, minTemp, maxTemp);

    this.service?.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.getHeatingThresholdTemperature());
    this.service?.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, this.getCoolingThresholdTemperature());

    const { context: ctx } = this.accessory;
    ctx.thresholds ??= {};
    this.platform.log.debug(`[${this.device.name}] Persisting updated heating and cooling thresholds`);
    ctx.thresholds.heatingTemperature = this.heatingThresholdTemperature;
    ctx.thresholds.coolingTemperature = this.coolingThresholdTemperature;
    this.platform.api.updatePlatformAccessories([this.accessory]);
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue) {
    this.setHeatingCoolingTemperatureThresholds({ cooling: Number(value) });
    await this.setTargetTemperatureWithinThresholds();
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    this.setHeatingCoolingTemperatureThresholds({ heating: Number(value) });
    await this.setTargetTemperatureWithinThresholds();
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
    return limitValue(this.device.attributes.FAN_SPEED ?? 0, 0, 100);
  }

  async setRotationSpeed(value: CharacteristicValue) {
    if (this.device.attributes.MODE === ACMode.AUTO) {
      this.platform.log.debug(`[${this.device.name}] Ignoring fan speed change because AC is in Auto mode`);
      // Update the characteristic back to the device value to reflect that it didn't change
      setTimeout(() => {
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
        this.fanService?.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
      }, 100);
      return;
    }
    // If setting a specific speed, we disable auto fan state
    await this.device.set_attribute({ FAN_SPEED: value as number });
  }

  private getFanSpeedSteps(): number[] {
    const mode = this.configDev.AC_options.fanSpeedMode;
    if (mode === '3') {
      return [33, 66, 100];
    } else if (mode === '5') {
      return [20, 40, 60, 80, 100, AUTO_FAN_SPEED];
    }
    return [];
  }

  getIndoorHumidity(): CharacteristicValue {
    let humidity = this.device.attributes.INDOOR_HUMIDITY;
    this.platform.log.debug(
      `[${this.device.name}] getIndoorHumidity: Device reports ${humidity}% (Fallback enabled: ${this.configDev.AC_options.humidityWeatherFallback})`,
    );
    if (humidity === undefined || humidity === 0 || humidity === 255) {
      if (this.configDev.AC_options.humidityWeatherFallback) {
        if (this.platform.weatherService.humidity !== undefined) {
          this.platform.log.info(
            `[${this.device.name}] Indoor humidity is invalid (${humidity}%), using weather fallback: ${this.platform.weatherService.humidity}%`,
          );
          humidity = this.platform.weatherService.humidity;
        } else {
          this.platform.log.warn(
            `[${this.device.name}] Indoor humidity is invalid (${humidity}%) and weather fallback is enabled but no weather data is available yet.`,
          );
        }
      } else if (humidity === 0 && this.platform.platformConfig.weather.enabled && !this.accessory.context.fallbackSuggested) {
        this.platform.log.info(
          `[${this.device.name}] Device reports 0% humidity. If this is incorrect, enable "Humidity Weather Fallback" in settings to use local weather data.`,
        );
        this.accessory.context.fallbackSuggested = true;
      }
    }
    const result = humidity ?? 0;
    this.platform.log.debug(`[${this.device.name}] getIndoorHumidity returning ${result}%`);
    return result;
  }

  getRealtimePower(): CharacteristicValue {
    // Some characteristics have minimum values (e.g. CurrentAmbientLightLevel must be at least 0.0001)
    const power = this.device.attributes.REALTIME_POWER ?? 0;
    if (this.configDev.AC_options.powerDisplayType === 'Lux') {
      return Math.max(power, 0.0001);
    }
    return power;
  }

  private getDisplayServiceType(type: string): any {
    switch (type) {
      case 'Humidity':
        return this.platform.Service.HumiditySensor;
      case 'CarbonDioxide':
        return this.platform.Service.CarbonDioxideSensor;
      case 'Temperature':
        return this.platform.Service.TemperatureSensor;
      default:
        return this.platform.Service.LightSensor;
    }
  }

  private getDisplayCharacteristic(type: string): any {
    switch (type) {
      case 'Humidity':
        return this.platform.Characteristic.CurrentRelativeHumidity;
      case 'CarbonDioxide':
        return this.platform.Characteristic.CarbonDioxideLevel;
      case 'Temperature':
        return this.platform.Characteristic.CurrentTemperature;
      default:
        return this.platform.Characteristic.CurrentAmbientLightLevel;
    }
  }

  private getDisplayUnit(type: string): string {
    switch (type) {
      case 'Humidity':
        return '%';
      case 'CarbonDioxide':
        return 'ppm';
      case 'Temperature':
        return '°C';
      case 'Lux':
        return 'lux';
      default:
        return '';
    }
  }

  getTotalEnergyConsumption(): CharacteristicValue {
    const current = this.device.attributes.TOTAL_ENERGY_CONSUMPTION ?? 0;
    if (current > (this.accessory.context.energy ?? 0)) {
      this.accessory.context.energy = current;
    }
    return this.accessory.context.energy ?? 0;
  }

  getOutdoorTemperature(): CharacteristicValue {
    return this.device.attributes.OUTDOOR_TEMPERATURE ?? -270;
  }

  getDisplayActive(): CharacteristicValue {
    return this.device.attributes.SCREEN_DISPLAY === true;
  }

  getFilterChangeIndication(): CharacteristicValue {
    return this.device.attributes.FULL_DUST
      ? this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER
      : this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
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
    return this.device.attributes.POWER === true && this.device.attributes.MODE === ACMode.DRY && !this.device.attributes.SELF_CLEAN;
  }

  async setDryMode(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, MODE: ACMode.DRY });
    } else {
      await this.device.set_attribute({ POWER: false });
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
    return this.device.attributes.POWER === true && this.device.attributes.AUX_HEATING === true;
  }

  async setAux(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ AUX_HEATING: true });
    } else {
      await this.device.set_attribute({ AUX_HEATING: false });
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
    if (value) {
      this.platform.log.info(`[${this.device.name}] Activating Self-cleaning mode`);
      // When activating self-clean, we ensure other modes are visually off
      await this.device.set_self_clean(true);
    } else {
      await this.device.set_self_clean(false);
    }
  }

  getIonState(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.ANION === true;
  }

  async setIonState(value: CharacteristicValue) {
    await this.device.set_attribute({ ANION: !!value });
  }

  getOutSilent(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.OUT_SILENT === true;
  }

  async setOutSilent(value: CharacteristicValue) {
    await this.device.set_out_silent(!!value);
  }

  getRateSelectOn(): CharacteristicValue {
    const value = this.device.attributes.RATE_SELECT;
    return this.device.attributes.POWER === true && value !== 0 && value !== 100 && value !== undefined;
  }

  async setRateSelectOn(value: CharacteristicValue) {
    if (value) {
      if (this.device.attributes.POWER !== true) {
        await this.device.set_attribute({ POWER: true });
      }
      if (this.getRateSelect() === 100) {
        await this.device.set_rate_select(2); // 50%
      }
    } else {
      await this.device.set_rate_select(0); // 100% (No limit)
    }
  }

  getRateSelect(): CharacteristicValue {
    const value = this.device.attributes.RATE_SELECT;
    if (value === 3 || value === 25) {
      return 25;
    } else if (value === 2 || value === 50) {
      return 50;
    } else if (value === 1 || value === 75) {
      return 75;
    } else if (value === 0 || value === 100) {
      return 100;
    } else if (value !== undefined && value > 0 && value <= 100) {
      return value;
    } else {
      return 100;
    }
  }

  async setRateSelect(value: CharacteristicValue) {
    const val = value as number;
    let code = 0;
    // Standard codes mapping
    if (val === 25) {
      code = 3;
    } else if (val === 50) {
      code = 2;
    } else if (val === 75) {
      code = 1;
    } else if (val === 100 || val === 0) {
      code = 0;
    } else {
      code = val;
    }

    // Try to support literal values if the device seems to use them
    if (val > 3 && (this.device.attributes.RATE_SELECT === undefined || this.device.attributes.RATE_SELECT > 3)) {
      code = val;
    }
    await this.device.set_rate_select(code);
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
    return this.device.attributes.POWER === true && this.device.attributes.COMFORT_SLEEP_MODE
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE;
  }

  async setSleepMode(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, COMFORT_SLEEP_MODE: true });
    } else {
      await this.device.set_attribute({ COMFORT_SLEEP_MODE: false });
    }
  }

  getComfortMode(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.COMFORT_MODE
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE;
  }

  async setComfortMode(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, COMFORT_MODE: true });
    } else {
      await this.device.set_attribute({ COMFORT_MODE: false });
    }
  }

  getCoolMode(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.MODE === ACMode.COOLING && !this.device.attributes.SELF_CLEAN;
  }

  async setCoolMode(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, MODE: ACMode.COOLING });
    } else {
      await this.device.set_attribute({ POWER: false });
    }
  }

  getHeatMode(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.MODE === ACMode.HEATING && !this.device.attributes.SELF_CLEAN;
  }

  async setHeatMode(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, MODE: ACMode.HEATING });
    } else {
      await this.device.set_attribute({ POWER: false });
    }
  }

  getAutoMode(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.MODE === ACMode.AUTO && !this.device.attributes.SELF_CLEAN;
  }

  async setAutoMode(value: CharacteristicValue) {
    if (value) {
      await this.device.set_attribute({ POWER: true, MODE: ACMode.AUTO });
    } else {
      await this.device.set_attribute({ POWER: false });
    }
  }

  getSmartEye(): CharacteristicValue {
    return this.device.attributes.POWER === true && this.device.attributes.SMART_EYE === true;
  }

  async setSmartEye(value: CharacteristicValue) {
    await this.device.set_attribute({ SMART_EYE: !!value });
  }

  getAudioFeedback(): CharacteristicValue {
    return this.device.attributes.PROMPT_TONE === true;
  }

  async setAudioFeedback(value: CharacteristicValue) {
    this.device.attributes.PROMPT_TONE = !!value;
    await this.device.set_attribute({ PROMPT_TONE: !!value });
  }

  getTimerActive(): CharacteristicValue {
    return this.timerEnd !== undefined && this.timerEnd > Date.now() ? 1 : 0;
  }

  async setTimerActive(value: CharacteristicValue) {
    if (value === 1) {
      // Start timer with default duration if not already set
      const duration = (this.timerService?.getCharacteristic(this.platform.Characteristic.SetDuration).value as number) || 3600;
      await this.setTimerDuration(duration);
    } else {
      // Stop timer
      if (this.timerTimeout) {
        clearTimeout(this.timerTimeout);
        this.timerTimeout = undefined;
      }
      this.timerEnd = undefined;
      this.timerService?.updateCharacteristic(this.platform.Characteristic.Active, 0);
      this.timerService?.updateCharacteristic(this.platform.Characteristic.InUse, 0);
      this.timerService?.updateCharacteristic(this.platform.Characteristic.RemainingDuration, 0);
    }
  }

  async setTimerDuration(value: CharacteristicValue) {
    const duration = value as number; // in seconds
    this.timerEnd = Date.now() + duration * 1000;
    if (this.timerTimeout) {
      clearTimeout(this.timerTimeout);
    }
    this.timerTimeout = setTimeout(async () => {
      this.platform.log.info(`[${this.device.name}] Timer expired, turning off AC`);
      await this.device.set_attribute({ POWER: false });
      this.timerEnd = undefined;
      this.timerTimeout = undefined;
      this.timerService?.updateCharacteristic(this.platform.Characteristic.Active, 0);
      this.timerService?.updateCharacteristic(this.platform.Characteristic.InUse, 0);
      this.timerService?.updateCharacteristic(this.platform.Characteristic.RemainingDuration, 0);
    }, duration * 1000);

    this.timerService?.updateCharacteristic(this.platform.Characteristic.Active, 1);
    this.timerService?.updateCharacteristic(this.platform.Characteristic.InUse, 1);
    this.timerService?.updateCharacteristic(this.platform.Characteristic.RemainingDuration, duration);
  }

  getTimerRemainingDuration(): CharacteristicValue {
    if (this.timerEnd === undefined) {
      return 0;
    }
    const remaining = Math.max(0, Math.floor((this.timerEnd - Date.now()) / 1000));
    return remaining;
  }
}
