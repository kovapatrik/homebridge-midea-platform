/***********************************************************************
 * Midea Heat Pump WiFi Controller Device class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */

import { Logger } from 'homebridge';
import MideaDevice, { DeviceAttributeBase } from '../../core/MideaDevice.js';
import { DeviceInfo } from '../../core/MideaConstants.js';
import { Config, DeviceConfig } from '../../platformUtils.js';
import { MessageRequest } from '../../core/MideaMessage.js';
import { MessageC3Response, MessageQuery, MessageSet, MessageSetECO, MessageSetSilent } from './MideaC3Message.js';

// Object that defines all attributes for air conditioner device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface C3Attributes extends DeviceAttributeBase {
  ZONE1_POWER: boolean;
  ZONE2_POWER: boolean;
  DHW_POWER: boolean;
  ZONE1_CURVE: boolean;
  ZONE2_CURVE: boolean;
  DISINFECT: boolean;
  FAST_DHW: boolean;
  ZONE_TEMPERATURE_TYPE: boolean[];
  ZONE1_ROOM_TEMPERATURE_MODE: boolean;
  ZONE2_ROOM_TEMPERATURE_MODE: boolean;
  ZONE1_WATER_TEMPERATURE_MODE: boolean;
  ZONE2_WATER_TEMPERATURE_MODE: boolean;
  MODE: number;
  MODE_AUTO: number;
  ZONE_TARGET_TEMPERATURE: number[];
  DHW_TARGET_TEMPERATURE: number;
  ROOM_TARGET_TEMPERATURE: number;
  ZONE_HEATING_TEMPERATURE_MAX: number[];
  ZONE_HEATING_TEMPERATURE_MIN: number[];
  ZONE_COOLING_TEMPERATURE_MAX: number[];
  ZONE_COOLING_TEMPERATURE_MIN: number[];
  TANK_ACTUAL_TEMPERATURE?: number;
  ROOM_TEMPERATURE_MAX: number;
  ROOM_TEMPERATURE_MIN: number;
  DHW_TEMPERATURE_MAX: number;
  DHW_TEMPERATURE_MIN: number;
  TARGET_TEMPERATURE: number[];
  TEMPERATURE_MAX: number[];
  TEMPERATURE_MIN: number[];
  STATUS_HEATING?: boolean;
  STATUS_DHW?: boolean;
  STATUS_TBH?: boolean;
  STATUS_IBH?: boolean;
  TOTAL_ENERGY_CONSUMPTION?: number;
  TOTAL_PRODUCED_ENERGY?: number;
  OUTDOOR_TEMPERATURE?: number;
  SILENT_MODE: boolean;
  ECO_MODE: boolean;
  TBH: boolean;
  ERROR_CODE: number;
}

export default class MideaC3Device extends MideaDevice {
  public attributes: C3Attributes;

  /*********************************************************************
   * Constructor initializes all the attributes.  We set some to invalid
   * values so that they are detected as "changed" on the first status
   * refresh... and passed back to the Homebridge/HomeKit accessory callback
   * function to set their initial values.
   */
  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);
    this.attributes = {
      ZONE1_POWER: false,
      ZONE2_POWER: false,
      DHW_POWER: false,
      ZONE1_CURVE: false,
      ZONE2_CURVE: false,
      DISINFECT: false,
      FAST_DHW: false,
      ZONE_TEMPERATURE_TYPE: [false, false],
      ZONE1_ROOM_TEMPERATURE_MODE: false,
      ZONE2_ROOM_TEMPERATURE_MODE: false,
      ZONE1_WATER_TEMPERATURE_MODE: false,
      ZONE2_WATER_TEMPERATURE_MODE: false,
      MODE: 0,
      MODE_AUTO: 0,
      ZONE_TARGET_TEMPERATURE: [25, 25],
      DHW_TARGET_TEMPERATURE: 25,
      ROOM_TARGET_TEMPERATURE: 30,
      ZONE_HEATING_TEMPERATURE_MAX: [55, 55],
      ZONE_HEATING_TEMPERATURE_MIN: [25, 25],
      ZONE_COOLING_TEMPERATURE_MAX: [25, 25],
      ZONE_COOLING_TEMPERATURE_MIN: [5, 5],
      TANK_ACTUAL_TEMPERATURE: undefined,
      ROOM_TEMPERATURE_MAX: 60,
      ROOM_TEMPERATURE_MIN: 34,
      DHW_TEMPERATURE_MAX: 60,
      DHW_TEMPERATURE_MIN: 20,
      TARGET_TEMPERATURE: [25, 25],
      TEMPERATURE_MAX: [0, 0],
      TEMPERATURE_MIN: [0, 0],
      STATUS_HEATING: undefined,
      STATUS_DHW: undefined,
      STATUS_TBH: undefined,
      STATUS_IBH: undefined,
      TOTAL_ENERGY_CONSUMPTION: undefined,
      TOTAL_PRODUCED_ENERGY: undefined,
      OUTDOOR_TEMPERATURE: undefined,
      SILENT_MODE: false,
      ECO_MODE: false,
      TBH: false,
      ERROR_CODE: 0,
    };
  }

  build_query(): MessageRequest[] {
    return [new MessageQuery(this.device_protocol_version)];
  }

  process_message(msg: Buffer) {
    const message = new MessageC3Response(msg);
    if (this.verbose) {
      this.logger.debug(`[${this.name}] Body:\n${JSON.stringify(message.body)}`);
    }
    const changed: DeviceAttributeBase = {};
    for (const status of Object.keys(this.attributes)) {
      const value = message.get_body_attribute(status.toLowerCase());
      if (value !== undefined) {
        if (this.attributes[status] !== value) {
          // Track only those attributes that change value.  So when we send to the Homebridge /
          // HomeKit accessory we only update values that change.  First time through this
          // should be most/all attributes having initialized them to invalid values.
          this.logger.debug(`[${this.name}] Value for ${status} changed from '${this.attributes[status]}' to '${value}'`);
          changed[status] = value;
        }
        this.attributes[status] = value;
      }
    }
    if (Object.keys(changed).includes('ZONE_TEMPERATURE_TYPE')) {
      for (const zone of [0, 1]) {
        if (this.attributes.ZONE_TEMPERATURE_TYPE[zone]) {
          // water temperature mode
          this.attributes.TARGET_TEMPERATURE[zone] = this.attributes.ZONE_TARGET_TEMPERATURE[zone];
          if (this.attributes.MODE_AUTO === 2) {
            // cooling mode
            this.attributes.TEMPERATURE_MAX[zone] = this.attributes.ZONE_COOLING_TEMPERATURE_MAX[zone];
            this.attributes.TEMPERATURE_MIN[zone] = this.attributes.ZONE_COOLING_TEMPERATURE_MIN[zone];
          } else if (this.attributes.MODE_AUTO === 3) {
            // heating mode
            this.attributes.TEMPERATURE_MAX[zone] = this.attributes.ZONE_HEATING_TEMPERATURE_MAX[zone];
            this.attributes.TEMPERATURE_MIN[zone] = this.attributes.ZONE_HEATING_TEMPERATURE_MIN[zone];
          }
        } else {
          // room temperature mode
          this.attributes.TARGET_TEMPERATURE[zone] = this.attributes.ROOM_TARGET_TEMPERATURE;
          this.attributes.TEMPERATURE_MAX[zone] = this.attributes.ROOM_TEMPERATURE_MAX;
          this.attributes.TEMPERATURE_MIN[zone] = this.attributes.ROOM_TEMPERATURE_MIN;
        }
      }

      if (this.attributes.ZONE1_POWER) {
        if (this.attributes.ZONE_TEMPERATURE_TYPE[0]) {
          this.attributes.ZONE1_WATER_TEMPERATURE_MODE = true;
          this.attributes.ZONE1_ROOM_TEMPERATURE_MODE = false;
        } else {
          this.attributes.ZONE1_WATER_TEMPERATURE_MODE = false;
          this.attributes.ZONE1_ROOM_TEMPERATURE_MODE = true;
        }
      } else {
        this.attributes.ZONE1_WATER_TEMPERATURE_MODE = false;
        this.attributes.ZONE1_ROOM_TEMPERATURE_MODE = false;
      }

      if (this.attributes.ZONE2_POWER) {
        if (this.attributes.ZONE_TEMPERATURE_TYPE[1]) {
          this.attributes.ZONE2_WATER_TEMPERATURE_MODE = true;
          this.attributes.ZONE2_ROOM_TEMPERATURE_MODE = false;
        } else {
          this.attributes.ZONE2_WATER_TEMPERATURE_MODE = false;
          this.attributes.ZONE2_ROOM_TEMPERATURE_MODE = true;
        }
      } else {
        this.attributes.ZONE2_WATER_TEMPERATURE_MODE = false;
        this.attributes.ZONE2_ROOM_TEMPERATURE_MODE = false;
      }

      changed.ZONE1_WATER_TEMPERATURE_MODE = this.attributes.ZONE1_WATER_TEMPERATURE_MODE;
      changed.ZONE1_ROOM_TEMPERATURE_MODE = this.attributes.ZONE1_ROOM_TEMPERATURE_MODE;
      changed.ZONE2_WATER_TEMPERATURE_MODE = this.attributes.ZONE2_WATER_TEMPERATURE_MODE;
      changed.ZONE2_ROOM_TEMPERATURE_MODE = this.attributes.ZONE2_ROOM_TEMPERATURE_MODE;
    }

    // Now we update Homebridge / Homekit accessory
    if (Object.keys(changed).length > 0) {
      this.update(changed);
    } else {
      this.logger.debug(`[${this.name}] Status unchanged`);
    }
  }

  make_message_set() {
    const message = new MessageSet(this.device_protocol_version);
    message.zone1_power = this.attributes.ZONE1_POWER;
    message.zone2_power = this.attributes.ZONE2_POWER;
    message.dhw_power = this.attributes.DHW_POWER;
    message.mode = this.attributes.MODE;
    message.zone_target_temperature = this.attributes.ZONE_TARGET_TEMPERATURE;
    message.dhw_target_temperature = this.attributes.DHW_TARGET_TEMPERATURE;
    message.room_target_temperature = this.attributes.ROOM_TARGET_TEMPERATURE;
    message.zone1_curve = this.attributes.ZONE1_CURVE;
    message.zone2_curve = this.attributes.ZONE2_CURVE;
    message.disinfect = this.attributes.DISINFECT;
    message.tbh = this.attributes.TBH;
    message.fast_dhw = this.attributes.FAST_DHW;
    return message;
  }

  async set_attribute(attributes: Partial<C3Attributes>) {
    const messageToSend: {
      SET: MessageSet | undefined;
      SILENT: MessageSetSilent | undefined;
      ECO: MessageSetECO | undefined;
    } = {
      SET: undefined,
      SILENT: undefined,
      ECO: undefined,
    };

    try {
      for (const [k, v] of Object.entries(attributes)) {
        if (v === this.attributes[k]) {
          this.logger.info(`[${this.name}] Attribute ${k} already set to ${v}`);
          continue;
        }
        this.logger.info(`[${this.name}] Set device attribute ${k} to: ${v}`);

        if (['ZONE1_POWER', 'ZONE2_POWER', 'DHW_POWER', 'ZONE1_CURVE', 'ZONE2_CURVE', 'DISINFECT', 'FAST_DHW', 'DHW_TARGET_TEMPERATURE', 'TBH'].includes(k)) {
          messageToSend.SET ??= new MessageSet(this.device_protocol_version);
          messageToSend.SET[k.toLowerCase()] = v;
        } else if (k === 'SILENT_MODE') {
          messageToSend.SILENT ??= new MessageSetSilent(this.device_protocol_version);
          messageToSend.SILENT[k.toLowerCase()] = v;
        } else if (k === 'ECO_MODE') {
          messageToSend.ECO ??= new MessageSetECO(this.device_protocol_version);
          messageToSend.ECO[k.toLowerCase()] = v;
        }
      }

      for (const [k, v] of Object.entries(messageToSend)) {
        if (v !== undefined) {
          this.logger.debug(`[${this.name}] Set message ${k}:\n${JSON.stringify(v)}`);
          await this.build_send(v);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.stack : err;
      this.logger.debug(`[${this.name}] Error in set_attribute (${this.ip}:${this.port}):\n${msg}`);
    }
  }

  async set_mode(zone: number, mode: number) {
    this.logger.info(`[${this.name}] Set mode for zone ${zone} to ${mode}`);
    const message = new MessageSet(this.device_protocol_version);
    if (zone === 0) {
      message.zone1_power = true;
    } else {
      message.zone2_power = true;
    }
    message.mode = mode;
    await this.build_send(message);
  }

  async set_target_temperature(zone: number, target_temperature: number, mode?: number) {
    this.logger.info(`[${this.name}] Set target temperature for zone ${zone} using mode ${mode} to ${target_temperature}`);
    const message = new MessageSet(this.device_protocol_version);
    if (this.attributes.ZONE_TEMPERATURE_TYPE[zone]) {
      message.zone_target_temperature[zone] = target_temperature;
    } else {
      message.room_target_temperature = target_temperature;
    }
    if (mode !== undefined) {
      if (zone === 0) {
        message.zone1_power = true;
      } else {
        message.zone2_power = true;
      }
      message.mode = mode;
    }
    await this.build_send(message);
  }

  protected set_subtype(): void {
    this.logger.debug('No subtype for C3 device');
  }
}
