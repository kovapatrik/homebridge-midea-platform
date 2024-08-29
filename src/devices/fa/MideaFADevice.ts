/***********************************************************************
 * Midea Fan class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */

import { Logger } from 'homebridge';
import MideaDevice, { DeviceAttributeBase } from '../../core/MideaDevice';
import { DeviceInfo } from '../../core/MideaConstants';
import { Config, DeviceConfig } from '../../platformUtils';
import { MessageRequest } from '../../core/MideaMessage';
import { MessageFAResponse, MessageQuery, MessageSet } from './MideaFAMessage';

// Object that defines all attributes for air conditioner device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface FAAttributes extends DeviceAttributeBase {
  POWER: boolean;
  CHILD_LOCK: boolean;
  MODE: number;
  FAN_SPEED: number;
  OSCILLATE: boolean;
  OSCILLATION_ANGLE: number;
  OSCILLATION_MODE: number;
  TILTING_ANGLE: number;
}

export default class MideaFADevice extends MideaDevice {
  public attributes: FAAttributes;

  private default_speed_count: number;
  private speed_count: number;

  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);

    this.attributes = {
      POWER: false,
      CHILD_LOCK: false,
      MODE: 0,
      FAN_SPEED: 0,
      OSCILLATE: false,
      OSCILLATION_ANGLE: 0,
      OSCILLATION_MODE: 0,
      TILTING_ANGLE: 0,
    };

    this.default_speed_count = 3;
    this.speed_count = this.default_speed_count;
  }

  build_query(): MessageRequest[] {
    return [new MessageQuery(this.device_protocol_version)];
  }

  process_message(msg: Buffer) {
    const message = new MessageFAResponse(msg);
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
    this.logger.debug('No subtype for FA device');
  }

  make_message_set(): MessageSet {
    const message = new MessageSet(this.device_protocol_version, this.sub_type);
    message.power = this.attributes.POWER;
    message.lock = this.attributes.CHILD_LOCK;
    message.mode = this.attributes.MODE;
    message.fan_speed = this.attributes.FAN_SPEED;
    message.oscillate = this.attributes.OSCILLATE;
    message.oscillation_angle = this.attributes.OSCILLATION_ANGLE;
    message.oscillation_mode = this.attributes.OSCILLATION_MODE;
    message.tilting_angle = this.attributes.TILTING_ANGLE;
    return message;
  }

  async set_attribute(attributes: Partial<FAAttributes>) {
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

        messageToSend.SET = messageToSend.SET ?? this.make_message_set();
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
