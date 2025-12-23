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
import { HeatStatus, MessageCCResponse, MessageQuery, MessageSet } from './MideaCCMessage.js';

// Object that defines all attributes for air conditioner device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface CCAttributes extends DeviceAttributeBase {
  POWER: boolean;
  MODE: number;
  TARGET_TEMPERATURE: number;
  FAN_SPEED: number;
  ECO: boolean;
  SLEEP: boolean;
  DISPLAY: boolean;
  AUX_HEATING: boolean;
  SWING_UD: boolean;
  SWING_LR: boolean;
  SWING_UD_SITE: number;
  SWING_LR_SITE: number;
  EXHAUST: boolean;
  TEMPERATURE_PRECISION: 1 | 0.5;
  CONTROL_FAN_SPEED: number;
  INDOOR_TEMPERATURE?: number;
  EVAPORATOR_ENTRANCE_TEMPERATURE?: number;
  EVAPORATOR_EXIT_TEMPERATURE?: number;
  PTC_SETTING: number;
  PTC_POWER: boolean;
  ERROR_CODE?: number;
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
      SLEEP: false,
      ECO: false,
      DISPLAY: false,
      EXHAUST: false,
      AUX_HEATING: false,
      PTC_SETTING: 0,
      PTC_POWER: false,
      SWING_UD: false,
      SWING_LR: false,
      SWING_UD_SITE: 0,
      SWING_LR_SITE: 0,
      CONTROL_FAN_SPEED: 0xFF,
      INDOOR_TEMPERATURE: undefined,
      EVAPORATOR_ENTRANCE_TEMPERATURE: undefined,
      EVAPORATOR_EXIT_TEMPERATURE: undefined,
      ERROR_CODE: undefined,
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

    const aux_heating = this.attributes.PTC_SETTING === HeatStatus.On || this.attributes.PTC_POWER;
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
    message.eco = this.attributes.ECO;
    message.sleep = this.attributes.SLEEP;
    message.display = this.attributes.DISPLAY;
    message.exhaust = this.attributes.EXHAUST;
    message.ptc_setting = this.attributes.PTC_SETTING;
    message.swing_ud = this.attributes.SWING_UD;
    message.swing_lr = this.attributes.SWING_LR;
    message.swing_lr_site = this.attributes.SWING_LR_SITE;
    message.swing_ud_site = this.attributes.SWING_UD_SITE;
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
