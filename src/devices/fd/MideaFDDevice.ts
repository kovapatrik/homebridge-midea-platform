/***********************************************************************
 * Midea Humidifier class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */

import type { Logger } from 'homebridge';
import type { DeviceInfo } from '../../core/MideaConstants.js';
import MideaDevice, { type DeviceAttributeBase } from '../../core/MideaDevice.js';
import type { MessageRequest } from '../../core/MideaMessage.js';
import type { Config, DeviceConfig } from '../../platformUtils.js';
import { MessageFDResponse, MessageQuery, MessageSet } from './MideaFDMessage.js';

// Object that defines all attributes for air conditioner device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface FDAttributes extends DeviceAttributeBase {
  POWER: boolean;
  FAN_SPEED: number;
  PROMPT_TONE: boolean;
  TARGET_HUMIDITY: number;
  CURRENT_HUMIDITY: number;
  CURRENT_TEMPERATURE: number;
  TANK: number;
  MODE: number;
  SCREEN_DISPLAY: number;
  DISINFECT?: boolean;
}

export default class MideaFDDevice extends MideaDevice {
  public attributes: FDAttributes;

  // private modes = ['Manual', 'Auto', 'Continuous', 'Living-Room', 'Bed-Room', 'Kitchen', 'Sleep'];

  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);

    this.attributes = {
      POWER: false,
      FAN_SPEED: 0,
      PROMPT_TONE: true,
      TARGET_HUMIDITY: 60,
      CURRENT_HUMIDITY: 0,
      CURRENT_TEMPERATURE: 0,
      TANK: 0,
      MODE: 0,
      SCREEN_DISPLAY: 0,
      DISINFECT: undefined,
    };
  }

  build_query(): MessageRequest[] {
    return [new MessageQuery(this.device_protocol_version)];
  }

  process_message(msg: Buffer) {
    const message = new MessageFDResponse(msg);
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

    // Now we update Homebridge / Homekit accessory
    if (Object.keys(changed).length > 0) {
      this.update(changed);
    } else {
      this.logger.debug(`[${this.name}] Status unchanged`);
    }
  }

  set_subtype(): void {
    this.logger.debug('No subtype for FD device');
  }

  make_message_set(): MessageSet {
    const message = new MessageSet(this.device_protocol_version);
    message.power = this.attributes.POWER;
    message.prompt_tone = this.attributes.PROMPT_TONE;
    message.screen_display = this.attributes.SCREEN_DISPLAY;
    message.disinfect = this.attributes.DISINFECT;
    message.mode = this.attributes.MODE;
    message.fan_speed = this.attributes.FAN_SPEED;
    message.target_humidity = this.attributes.TARGET_HUMIDITY;
    return message;
  }

  async set_attribute(attributes: Partial<FDAttributes>) {
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
