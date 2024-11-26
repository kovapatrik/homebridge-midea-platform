/***********************************************************************
 * Midea Heat Pump WiFi Controller Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import { Service } from 'homebridge';
import { MideaAccessory, MideaPlatform } from '../platform.js';
import BaseAccessory from './BaseAccessory.js';
import { DeviceConfig } from '../platformUtils.js';
import MideaC3Device, { C3Attributes } from '../devices/c3/MideaC3Device.js';

export default class HeatPumpWiFiControllerAccessory extends BaseAccessory<MideaC3Device> {

  protected service: Service;

  // Zone1 related
  private zone1Service?: Service;
  private zone1CurveSwitchService?: Service;
  private zone1PowerSwitchService?: Service;
  private zone1WaterTemperatureModeSensorService?: Service;
  private zone1RoomTemperatureModeService?: Service;

  // Zone2 related
  private zone2Service?: Service;
  private zone2CurveSwitchService?: Service;
  private zone2PowerSwitchService?: Service;
  private zone2WaterTemperatureModeSensorService?: Service;
  private zone2RoomTemperatureModeService?: Service;

  // Water heater related
  private waterHeaterService?: Service;
  private dhwPowerSwitchService?: Service;
  private tbhPowerSwitchService?: Service;
  private dhwSensorService?: Service;
  private tbhSensorService?: Service;
  private ibhSensorService?: Service;
  private heatingSensorService?: Service;

  private disinfectSwitchService?: Service;
  private ecoSwitchService?: Service;
  private silentModeSwitchService?: Service;

  /*********************************************************************
   * Constructor registers all the service types with Homebridge, registers
   * a callback function with the MideaDevice class, and requests device status.
   */
  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaC3Device,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.zone1Service = this.accessory.getService(this.platform.Service.Valve) || this.accessory.addService(this.platform.Service.Valve);

    this.service = this.zone1Service;
  }

  async updateCharacteristics(attributes: Partial<C3Attributes>) {
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
}
