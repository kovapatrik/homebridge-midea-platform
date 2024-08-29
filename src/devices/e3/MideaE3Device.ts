/***********************************************************************
 * Midea Gas Water Heater Device class
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
import { MessageE3Response, MessageNewProtocolSet, MessagePower, MessageQuery, MessageSet, NewProtocolTags } from './MideaE3Message';

// Object that defines all attributes for air conditioner device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface E3Attributes extends DeviceAttributeBase {
  POWER: boolean;
  BURNING_STATE: boolean;
  ZERO_COLD_WATER: boolean;
  PROTECTION: boolean;
  ZERO_COLD_PULSE: boolean;
  SMART_VOLUME: boolean;
  CURRENT_TEMPERATURE?: number;
  TARGET_TEMPERATURE: number;
}

export default class MideaE3Device extends MideaDevice {
  public attributes: E3Attributes;

  private _old_subtypes = [32, 33, 34, 35, 36, 37, 40, 43, 48, 49, 80];
  private _precision_halves: boolean;

  /*********************************************************************
   * Constructor initializes all the attributes.  We set some to invalid
   * values so that they are detected as "changed" on the first status
   * refresh... and passed back to the Homebridge/HomeKit accessory callback
   * function to set their initial values.
   */
  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);
    this.attributes = {
      POWER: false,
      BURNING_STATE: false,
      ZERO_COLD_WATER: false,
      PROTECTION: false,
      ZERO_COLD_PULSE: false,
      SMART_VOLUME: false,
      CURRENT_TEMPERATURE: undefined,
      TARGET_TEMPERATURE: 40,
    };
    this._precision_halves = deviceConfig.E3_options.precisionHalves;
  }

  get precision_halves(): boolean {
    return this._precision_halves;
  }

  build_query(): MessageRequest[] {
    return [new MessageQuery(this.device_protocol_version)];
  }

  process_message(msg: Buffer) {
    const message = new MessageE3Response(msg);
    if (this.verbose) {
      this.logger.debug(`[${this.name}] Body:\n${JSON.stringify(message.body)}`);
    }
    const changed: DeviceAttributeBase = {};
    for (const status of Object.keys(this.attributes)) {
      let value = message.get_body_attribute(status.toLowerCase());
      if (value !== undefined) {
        if (this.attributes[status] !== value) {
          // Track only those attributes that change value.  So when we send to the Homebridge /
          // HomeKit accessory we only update values that change.  First time through this
          // should be most/all attributes having initialized them to invalid values.
          if (this.precision_halves && ['CURRENT_TEMPERATURE', 'TARGET_TEMPERATURE'].includes(status)) {
            value = value / 2;
          }
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

  make_message_set() {
    const message = new MessageSet(this.device_protocol_version);
    message.zero_cold_water = this.attributes.ZERO_COLD_WATER;
    message.protection = this.attributes.PROTECTION;
    message.zero_cold_pulse = this.attributes.ZERO_COLD_PULSE;
    message.smart_volume = this.attributes.SMART_VOLUME;
    message.target_temperature = this.attributes.TARGET_TEMPERATURE;
    return message;
  }

  async set_attribute(attributes: Partial<E3Attributes>) {
    const messageToSend: {
      POWER: MessagePower | undefined;
      SET: MessageSet | undefined;
      NEW_PROTOCOL_SET: MessageNewProtocolSet | undefined;
    } = {
      POWER: undefined,
      SET: undefined,
      NEW_PROTOCOL_SET: undefined,
    };

    try {
      for (const [k, v] of Object.entries(attributes)) {
        if (v === this.attributes[k]) {
          this.logger.info(`[${this.name}] Attribute ${k} already set to ${v}`);
          continue;
        }
        this.logger.info(`[${this.name}] Set device attribute ${k} to: ${v}`);

        if (this.precision_halves && k === 'TARGET_TEMPERATURE') {
          const value = ((v as number) * 2) | 0;
          this.attributes[k] = value;
        } else {
          this.attributes[k] = v;
        }

        // not sensor data
        if (!['BURNING_STATE', 'CURRENT_TEMPERATURE', 'PROTECTION'].includes(k)) {
          if (k === 'POWER') {
            messageToSend.POWER = messageToSend.POWER ?? new MessagePower(this.device_protocol_version);
            messageToSend.POWER.power = v as boolean;
          } else if (this._old_subtypes.includes(this.sub_type)) {
            messageToSend.SET = messageToSend.SET ?? this.make_message_set();
            messageToSend.SET[k.toLowerCase()] = v;
          } else {
            messageToSend.NEW_PROTOCOL_SET = messageToSend.NEW_PROTOCOL_SET ?? new MessageNewProtocolSet(this.device_protocol_version);
            messageToSend.NEW_PROTOCOL_SET.key = k as keyof typeof NewProtocolTags;
            messageToSend.NEW_PROTOCOL_SET.value = v as number | boolean;
          }
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

  protected set_subtype(): void {
    this.logger.debug('No subtype for E3 device');
  }
}
