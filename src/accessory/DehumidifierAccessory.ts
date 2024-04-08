/***********************************************************************
 * Midea Platform Dehumidifier Accessory class
 *
 * Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 * With thanks to https://github.com/kovapatrik/homebridge-midea-platform
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import { CharacteristicValue, Service } from 'homebridge';
import { MideaAccessory, MideaPlatform } from '../platform';
import BaseAccessory from './BaseAccessory';
import { DeviceConfig, WaterTankSensor } from '../platformUtils';
import MideaA1Device, { A1Attributes } from '../devices/a1/MideaA1Device';

export default class DehumidifierAccessory extends BaseAccessory<MideaA1Device> {
  private service: Service;

  private temperatureService?: Service;
  private pumpService?: Service;
  private waterTankService?: Service;
  // Increment this every time we make a change to accessory that requires
  // previously cached Homebridge service to be deleted/replaced.
  private serviceVersion = 1;

  /*********************************************************************
   * Constructor registers all the service types with Homebridge, registers
   * a callback function with the MideaDevice class, and requests device status.
   */
  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaA1Device,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.platform.log.debug(
      `[${device.name}] Dehumidifier serviceVersion: ${this.serviceVersion}, currentVersion: ${this.accessory.context.serviceVersion}`,
    );

    const service = this.accessory.getService(this.platform.Service.HumidifierDehumidifier);

    if (service && this.accessory.context.serviceVersion !== this.serviceVersion) {
      this.platform.log.info(
        `[${this.device.name}] New dehumidifier service version.\
          Upgrade from v${this.accessory.context.serviceVersion} to v${this.serviceVersion}.`,
      );
      this.accessory.removeService(service);
      this.service = this.accessory.addService(this.platform.Service.HumidifierDehumidifier);
      this.accessory.context.serviceVersion = this.serviceVersion;
    } else if (service) {
      this.platform.log.debug(`[${this.device.name}] Existing dehumidifier service version.`);
      this.service = service;
    } else {
      this.platform.log.debug(`[${this.device.name}] Creating new dehumidifier service.`);
      this.service = this.accessory.addService(this.platform.Service.HumidifierDehumidifier);
      this.accessory.context.serviceVersion = this.serviceVersion;
    }

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHumidifierDehumidifierState)
      .onGet(this.getCurrentHumidifierDehumidifierState.bind(this));

    // need to set as dehumidifier before setting validValues as defult of 0 will
    // throw error when we state that only valid value is dehumidifier (2).
    this.service.updateCharacteristic(
      this.platform.Characteristic.TargetHumidifierDehumidifierState,
      this.platform.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER,
    );
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHumidifierDehumidifierState)
      .onGet(this.getTargetHumidifierDehumidifierState.bind(this))
      .onSet(this.setTargetHumidifierDehumidifierState.bind(this))
      .setProps({
        validValues: [this.platform.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER],
      });

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this))
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: 1,
      });

    this.service
      .getCharacteristic(this.platform.Characteristic.RelativeHumidityDehumidifierThreshold)
      .onGet(this.getRelativeHumidityDehumidifierThreshold.bind(this))
      .onSet(this.setRelativeHumidityDehumidifierThreshold.bind(this))
      .setProps({
        minValue: 0, // need this to be 0..100 so that Apple Home User Inteface humidity percent matched
        maxValue: 100, // what we set to the himdifier.  If we have this as 35..85 then Apple Home UI will not match.
        minStep: 5,
      });

    this.service
      .getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.WaterLevel).onGet(this.getWaterLevel.bind(this));

    // Temperature sensor
    this.temperatureService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'Temperature');
    if (this.configDev.A1_options.temperatureSensor) {
      this.temperatureService ??= this.accessory.addService(this.platform.Service.TemperatureSensor, 'Temperature', 'Temperature');
      this.temperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getTemperature.bind(this));
    } else if (this.temperatureService) {
      this.accessory.removeService(this.temperatureService);
    }

    // Pump switch
    this.pumpService = this.accessory.getServiceById(this.platform.Service.Switch, 'Pump');
    if (this.configDev.A1_options.pumpSwitch) {
      this.pumpService ??= this.accessory.addService(this.platform.Service.Switch, 'Pump', 'Pump');
      this.pumpService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Pump`);
      this.pumpService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Pump`);
      this.pumpService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getPump.bind(this)).onSet(this.setPump.bind(this));
    } else if (this.pumpService) {
      this.accessory.removeService(this.pumpService);
    }

    this.waterTankService =
      this.accessory.getServiceById(this.platform.Service.ContactSensor, 'WaterTankContact') ??
      this.accessory.getServiceById(this.platform.Service.LeakSensor, 'WaterTankLeak');
    if (this.configDev.A1_options.waterTankSensor !== WaterTankSensor.NONE) {
      if (this.configDev.A1_options.waterTankSensor === WaterTankSensor.CONTACT_SENSOR) {
        this.waterTankService ??= this.accessory.addService(
          this.platform.Service.ContactSensor,
          `${this.device.name} Water Tank Sensor`,
          'WaterTankContact',
        );
        this.waterTankService.getCharacteristic(this.platform.Characteristic.ContactSensorState).onGet(this.getWaterTankFull.bind(this));
      } else {
        this.waterTankService ??= this.accessory.addService(
          this.platform.Service.LeakSensor,
          `${this.device.name} Water Tank Sensor`,
          'WaterTankLeak',
        );
        this.waterTankService.getCharacteristic(this.platform.Characteristic.LeakDetected).onGet(this.getWaterTankFull.bind(this));
      }
      this.waterTankService.setCharacteristic(this.platform.Characteristic.Name, `${this.device.name} Water Tank Sensor`);
      this.waterTankService.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${this.device.name} Water Tank Sensor`);
    } else if (this.waterTankService) {
      this.accessory.removeService(this.waterTankService);
    }

    // Register a callback function with MideaDevice and then refresh device status.  The callback
    // is called whenever there is a change in any attribute value from the device.
    this.device.on('update', this.updateCharacteristics.bind(this));
    this.device.refresh_status();
  }

  /*********************************************************************
   * Callback function called by MideaDevice whenever there is a change to
   * any attribute value.
   */
  private async updateCharacteristics(attributes: Partial<A1Attributes>) {
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
        case 'target_humidity':
          this.service.updateCharacteristic(this.platform.Characteristic.RelativeHumidityDehumidifierThreshold, v as CharacteristicValue);
          updateState = true;
          break;
        case 'fan_speed':
          this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, v as CharacteristicValue);
          break;
        case 'current_humidity':
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, v as CharacteristicValue);
          updateState = true;
          break;
        case 'mode':
          updateState = true;
          break;
        case 'current_temperature':
          this.temperatureService?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, v as CharacteristicValue);
          break;
        case 'tank_level':
          this.service.updateCharacteristic(this.platform.Characteristic.WaterLevel, v as CharacteristicValue);
          break;
        case 'pump':
          this.pumpService?.updateCharacteristic(this.platform.Characteristic.On, v as CharacteristicValue);
          break;
        case 'tank_full':
          if (this.configDev.A1_options.waterTankSensor === WaterTankSensor.LEAK_SENSOR) {
            this.waterTankService?.updateCharacteristic(this.platform.Characteristic.LeakDetected, v as CharacteristicValue);
          } else if (this.configDev.A1_options.waterTankSensor === WaterTankSensor.CONTACT_SENSOR) {
            this.waterTankService?.updateCharacteristic(this.platform.Characteristic.ContactSensorState, v as CharacteristicValue);
          }
          break;
        case 'water_level_set':
          // No HomeKit characteristic
          break;
        case 'swing':
          // No HomeKit characteristic
          break;
        case 'child_lock':
          // No HomeKit characteristic
          break;
        default:
          this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
      }
      if (updateState) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.TargetHumidifierDehumidifierState,
          this.platform.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER,
        );
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentHumidifierDehumidifierState,
          this.currentHumidifierDehumidifierState(),
        );
      }
    }
  }

  /*********************************************************************
   * Callback functions for each Homebridge/HomeKit service
   *
   */
  private async getActive(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET Active, value: ${this.device.attributes.POWER}`);
    return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  private async setActive(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] SET Active to: ${value}`);
    await this.device.set_attribute({ POWER: !!value });
  }

  // Handle requests to get the current value of the "HumidifierDehumidifierState" characteristic
  private async getCurrentHumidifierDehumidifierState(): Promise<CharacteristicValue> {
    this.platform.log.debug(
      `[${this.device.name}] GET CurrentHumidifierDehumidifierState, value: ${this.device.attributes.POWER},${this.device.attributes.MODE}`,
    );
    return this.currentHumidifierDehumidifierState();
  }

  private currentHumidifierDehumidifierState(): CharacteristicValue {
    if (!this.device.attributes.POWER) {
      // Powered off, must be inactive
      return this.platform.Characteristic.CurrentHumidifierDehumidifierState.INACTIVE;
    } else {
      // Powered on, check mode
      if (this.device.attributes.MODE >= 2) {
        // Dehumidifying
        return this.platform.Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING;
      } else if (this.device.attributes.MODE === 1) {
        // Whether deumidifying depends on whether we have reached target.  This is not
        // always accurate, but is best we can do to signal whether actively dehumidifing or not.
        if (this.device.attributes.CURRENT_HUMIDITY < this.device.attributes.TARGET_HUMIDITY) {
          return this.platform.Characteristic.CurrentHumidifierDehumidifierState.IDLE;
        } else {
          return this.platform.Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING;
        }
      }
      return this.platform.Characteristic.CurrentHumidifierDehumidifierState.IDLE;
    }
  }

  // Handle requests to get the target value of the "HumidifierDehumidifierState" characteristic
  private async getTargetHumidifierDehumidifierState(): Promise<CharacteristicValue> {
    this.platform.log.debug(
      // eslint-disable-next-line max-len
      `[${this.device.name}] GET TargetHumidifierDehumidifierState, value: ${this.platform.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER}`,
    );
    // Always return that we are a dehumidifier, other states not supported.
    return this.platform.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER;
  }

  // Handle requests to set the target value of the "HumidifierDehumidifierState" characteristic
  private async setTargetHumidifierDehumidifierState(value: CharacteristicValue): Promise<void> {
    this.platform.log.debug(`[${this.device.name}] SET TargetHumidifierDehumidifierState to: ${value}`);
    if (value !== this.platform.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER) {
      throw new Error(`Device ${this.device.name} (${this.device.id}) can only be a DeHumidifier, illegal value: ${value}`);
    }
  }

  // Handle requests to get the current value of the "RelativeHumidity" characteristic
  private async getCurrentRelativeHumidity(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET CurrentRelativeHumidity, value: ${this.device.attributes.CURRENT_HUMIDITY}`);
    return this.device.attributes.CURRENT_HUMIDITY;
  }

  // Handle requests to get the Relative value of the "HumidityDehumidifierThreshold" characteristic
  private async getRelativeHumidityDehumidifierThreshold(): Promise<CharacteristicValue> {
    this.platform.log.debug(
      `[${this.device.name}] GET RelativeHumidityDehumidifierThreshold, value: ${this.device.attributes.TARGET_HUMIDITY}`,
    );
    return this.device.attributes.TARGET_HUMIDITY;
  }

  // Handle requests to set the Relative value of the "HumidityDehumidifierThreshold" characteristic
  private async setRelativeHumidityDehumidifierThreshold(value: CharacteristicValue): Promise<void> {
    let RequestedHumidity = value as number;
    // valid humidity has to be between min and max values
    RequestedHumidity =
      RequestedHumidity < this.device.MIN_HUMIDITY
        ? this.device.MIN_HUMIDITY
        : RequestedHumidity > this.device.MAX_HUMIDITY
        ? this.device.MAX_HUMIDITY
        : RequestedHumidity;

    this.platform.log.debug(
      `[${this.device.name}] SET RelativeHumidityDehumidifierThreshold to: ${RequestedHumidity} (${value as number})`,
    );
    await this.device.set_attribute({ TARGET_HUMIDITY: RequestedHumidity });
    // Update HomeKit in case we adjusted the value outside of min and max values
    if (RequestedHumidity !== (value as number)) {
      // We had to adjust the requested value to within permitted range...  Update homekit to actual value set.
      // Calling updateCharacteristic within set handler seems to fail, new value is not accepted.  Workaround is
      // to request the update after short delay (say 50ms) to allow homebridge/homekit to complete the set handler.
      setTimeout(() => {
        this.service.updateCharacteristic(this.platform.Characteristic.RelativeHumidityDehumidifierThreshold, RequestedHumidity);
      }, 50);
    }
  }

  // Handle requests to get the current value of the "RotationSpeed" characteristic
  private async getRotationSpeed(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET RotationSpeed, value: ${this.device.attributes.FAN_SPEED}`);
    return this.device.attributes.FAN_SPEED;
  }

  // Handle requests to set the "RotationSpeed" characteristic
  private async setRotationSpeed(value: CharacteristicValue) {
    let speed = value as number;
    speed = speed <= 40 ? 40 : speed > 40 && speed <= 60 ? 60 : 80;
    this.platform.log.debug(`[${this.device.name}] SET RotationSpeed to: ${speed} (${value as number})`);
    await this.device.set_attribute({ FAN_SPEED: speed });
    if (speed !== (value as number)) {
      // We had to adjust the requested value to within permitted range...  Update homekit to actual value set.
      // Calling updateCharacteristic within set handler seems to fail, new value is not accepted.  Workaround is
      // to request the update after short delay (say 50ms) to allow homebridge/homekit to complete the set handler.
      setTimeout(() => {
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, speed);
      }, 50);
    }
  }

  // Handle requests to get the current value of the "WaterLevel" characteristic
  private async getWaterLevel(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET WaterLevel, value: ${this.device.attributes.TANK_LEVEL}`);
    return this.device.attributes.TANK_LEVEL;
  }

  // Handle requests to get the current value of the "Pump" characteristic
  private getTemperature(): CharacteristicValue {
    this.platform.log.debug(`[${this.device.name}] GET Temperature, value: ${this.device.attributes.CURRENT_TEMPERATURE}`);
    return this.device.attributes.CURRENT_TEMPERATURE;
  }

  // Handle requests to get the current value of the "Pump" characteristic
  private async getPump(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET Pump, value: ${this.device.attributes.PUMP}`);
    return this.device.attributes.POWER === true && this.device.attributes.PUMP;
  }

  // Handle requests to set the "Pump" characteristic
  private async setPump(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] SET Pump to: ${value}`);
    await this.device.set_attribute({ PUMP: !!value });
  }

  // Handle requests to get the current value of the "WaterTankFull" characteristic
  private getWaterTankFull(): CharacteristicValue {
    this.platform.log.debug(`[${this.device.name}] GET WaterTankFull, value: ${this.device.attributes.TANK_FULL}`);
    return this.device.attributes.TANK_FULL ?? false;
  }
}
