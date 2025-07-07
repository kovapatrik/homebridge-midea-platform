/***********************************************************************
 * Midea MDV Wi-Fi Controller Device class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */

import type { Logger } from 'homebridge';
import type { DeviceInfo } from '../../core/MideaConstants.js';
import MideaDevice, { type DeviceAttributeBase } from '../../core/MideaDevice.js';
import type { MessageRequest } from '../../core/MideaMessage.js';
import type { Config, DeviceConfig } from '../../platformUtils.js';
import { MessageCCResponse, MessageQuery, MessageSet } from './MideaCCMessage.js';

// Object that defines all attributes for air conditioner device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface CCAttributes extends DeviceAttributeBase {
  POWER: boolean;
  MODE: number;
  TARGET_TEMPERATURE: number;
  FAN_SPEED: number;
  ECO_MODE: boolean;
  SLEEP_MODE: boolean;
  NIGHT_LIGHT: boolean;
  AUX_HEATING: boolean;
  SWING: boolean;
  VENTILATION: boolean;
  TEMPERATURE_PRECISION: 1 | 0.5;
  FAN_SPEED_LEVEL?: boolean;
  INDOOR_TEMPERATURE?: number;
  AUX_HEAT_STATUS: number;
  AUTO_AUX_HEAT_RUNNING: boolean;
  TEMP_FAHRENHEIT: boolean;
}

enum FAN_SPEEDS_7LEVEL {
  'Level 1' = 0x01,
  'Level 2' = 0x02,
  'Level 3' = 0x04,
  'Level 4' = 0x08,
  'Level 5' = 0x10,
  'Level 6' = 0x20,
  'Level 7' = 0x40,
  Auto = 0x80,
}

enum FAN_SPEEDS_3LEVEL {
  Low = 0x01,
  Medium = 0x08,
  High = 0x40,
  Auto = 0x80,
}

export default class MideaCCDevice extends MideaDevice {
  public attributes: CCAttributes;

  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);

    this.attributes = {
      POWER: false,
      MODE: 1,
      TARGET_TEMPERATURE: 26,
      FAN_SPEED: 0x80,
      SLEEP_MODE: false,
      ECO_MODE: false,
      NIGHT_LIGHT: false,
      VENTILATION: false,
      AUX_HEATING: false,
      AUX_HEAT_STATUS: 0,
      AUTO_AUX_HEAT_RUNNING: false,
      SWING: false,
      FAN_SPEED_LEVEL: undefined,
      INDOOR_TEMPERATURE: undefined,
      TEMPERATURE_PRECISION: 1,
      TEMP_FAHRENHEIT: false,
    };
  }

  build_query(): MessageRequest[] {
    return [new MessageQuery(this.device_protocol_version)];
  }

  process_message(msg: Buffer) {
    const message = new MessageCCResponse(msg);
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

    const aux_heating = this.attributes.AUX_HEAT_STATUS === 1 || this.attributes.AUTO_AUX_HEAT_RUNNING;
    if (aux_heating !== this.attributes.AUX_HEATING) {
      this.attributes.AUX_HEATING = aux_heating;
      changed.AUX_HEATING = aux_heating;
    }

    // Now we update Homebridge / Homekit accessory
    if (Object.keys(changed).length > 0) {
      this.update(changed);
    } else {
      this.logger.debug(`[${this.name}] Status unchanged`);
    }
  }

  set_subtype(): void {
    this.logger.debug('No subtype for CC device');
  }

  make_message_set(): MessageSet {
    const message = new MessageSet(this.device_protocol_version);
    message.power = this.attributes.POWER;
    message.mode = this.attributes.MODE;
    message.target_temperature = this.attributes.TARGET_TEMPERATURE;
    message.fan_speed = this.attributes.FAN_SPEED;
    message.eco_mode = this.attributes.ECO_MODE;
    message.sleep_mode = this.attributes.SLEEP_MODE;
    message.night_light = this.attributes.NIGHT_LIGHT;
    message.aux_heat_status = this.attributes.AUX_HEAT_STATUS;
    message.swing = this.attributes.SWING;
    return message;
  }

  async set_attribute(attributes: Partial<CCAttributes>) {
    const messageToSend: {
      SET: MessageSet | undefined;
    } = {
      SET: undefined,
    };

    try {
      for (const [k, v] of Object.entries(attributes)) {
        if (v === this.attributes[k]) {
          this.logger.info(`[${this.name}] Attribute ${k} already set to ${v}`);
          continue;
        }
        this.logger.info(`[${this.name}] Set device attribute ${k} to: ${v}`);
        this.attributes[k] = v;

        messageToSend.SET ??= this.make_message_set();
        messageToSend.SET[k.toLowerCase()] = v;
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
}
