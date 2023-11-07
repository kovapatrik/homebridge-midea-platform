/***********************************************************************
 * Midea Dehumidifier Device class
 *
 * Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * With thanks to https://github.com/kovapatrik/homebridge-midea-platform
 * And https://github.com/georgezhao2010/midea_ac_lan
 *
 * An instance of this class is created for each device the platform registers.
 *
 */
import { Logger } from 'homebridge';
import { DeviceInfo } from '../../core/MideaConstants';
import MideaDevice, { DeviceAttributeBase } from '../../core/MideaDevice';
import { MessageQuery, MessageA1Response, MessageSet } from './MideaA1Message';
import { Config, DeviceConfig } from '../../platformUtils';

// Object that defines all attributes for dehumidifier device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface A1Attributes extends DeviceAttributeBase {
  POWER: boolean | undefined;
  PROMPT_TONE: boolean;
  CHILD_LOCK: boolean | undefined;
  MODE: number;
  FAN_SPEED: number;
  SWING: boolean | undefined;
  TARGET_HUMIDITY: number;
  ANION: boolean;
  TANK_LEVEL: number;
  WATER_LEVEL_SET: number;
  TANK_FULL: boolean | undefined;
  CURRENT_HUMIDITY: number;
  CURRENT_TEMPERATURE: number;
  DEFROSTING: boolean;
  FILTER_INDICATOR: boolean;
  PUMP: boolean;
  PUMP_SWITCH_FLAG: boolean;
  SLEEP_MODE: boolean;
}

export default class MideaA1Device extends MideaDevice {
  readonly MIN_HUMIDITY: number;
  readonly MAX_HUMIDITY: number;
  readonly HUMIDITY_STEP: number;
  public attributes: A1Attributes;

  readonly MODES = {
    0: 'Off',
    1: 'Auto',
    2: 'Continuous',
    3: 'Clothes-Dry',
    4: 'Shoes-Dry',
  };

  readonly SPEEDS = {
    1: 'Lowest',
    40: 'Low',
    60: 'Medium',
    80: 'High',
    102: 'Auto',
    127: 'Off',
  };

  readonly WATER_LEVEL_SETS = {
    25: 'Low',
    50: 'Medium',
    75: 'High',
    100: 'Full',
  };

  /*********************************************************************
   * Constructor initializes all the attributes.  We set some to invalid
   * values so that they are detected as "changed" on the first status
   * refresh... and passed back to the Homebridge/HomeKit accessory callback
   * function to set their initial values.
   */
  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);

    this.attributes = {
      POWER: undefined, // invalid
      PROMPT_TONE: false,
      CHILD_LOCK: undefined, // invalid
      MODE: 99, // invalid
      FAN_SPEED: 999, // invalid
      SWING: undefined, // invalid
      TARGET_HUMIDITY: 999, // invalid
      ANION: false,
      TANK_LEVEL: 999, // invalid
      WATER_LEVEL_SET: 999, // invalid
      TANK_FULL: undefined, // invalid
      CURRENT_HUMIDITY: 999, // invalid
      CURRENT_TEMPERATURE: 999, // invalid
      DEFROSTING: false,
      FILTER_INDICATOR: false,
      PUMP: false,
      PUMP_SWITCH_FLAG: false,
      SLEEP_MODE: false,
    };

    this.MIN_HUMIDITY = deviceConfig.A1_options.minHumidity;
    this.MAX_HUMIDITY = deviceConfig.A1_options.maxHumidity;
    this.HUMIDITY_STEP = deviceConfig.A1_options.humidityStep;
  }

  build_query() {
    return [new MessageQuery(this.device_protocol_version)];
  }

  process_message(msg: Buffer) {
    const message = new MessageA1Response(msg);
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
    const value = this.attributes.TANK_LEVEL >= this.attributes.WATER_LEVEL_SET;
    if (this.attributes.TANK_FULL !== value) {
      this.logger.debug(`[${this.name}] Value for TANK_FULL changed from '${this.attributes.TANK_FULL}' to '${value}'`);
      changed.TANK_FULL = value;
    }
    this.attributes.TANK_FULL = value;

    // Now we update Homebridge / Homekit accessory
    if (Object.keys(changed).length > 0) {
      this.update(changed);
    } else {
      this.logger.debug(`[${this.name}] Status unchanged`);
    }
  }

  make_message_set() {
    const message = new MessageSet(this.device_protocol_version);
    message.power = !!this.attributes.POWER; // force to boolean
    message.prompt_tone = this.attributes.PROMPT_TONE;
    message.mode = this.attributes.MODE;
    message.child_lock = !!this.attributes.CHILD_LOCK; // force to boolean
    message.fan_speed = this.attributes.FAN_SPEED;
    message.target_humidity = this.attributes.TARGET_HUMIDITY;
    message.swing = !!this.attributes.SWING;
    message.anion = this.attributes.ANION;
    message.water_level_set = this.attributes.WATER_LEVEL_SET;
    return message;
  }

  async set_attribute(attributes: Partial<A1Attributes>) {
    try {
      for (const [k, v] of Object.entries(attributes)) {
        let message: MessageSet | undefined = undefined;
        this.logger.info(`[${this.name}] Set device attribute ${k} to: ${v}`);

        // not sensor data
        if (!['CURRENT_TEMPERATURE', 'CURRENT_HUMIDITY', 'TANK_FULL', 'DEFROSTING', 'FILTER_INDICATOR', 'PUMP'].includes(k)) {
          this.attributes[k] = v;

          if (k === 'PROMPT_TONE') {
            this.attributes.PROMPT_TONE = !!v;
          } else {
            message = this.make_message_set();
            // TODO handle MODE, FAN_SPEED and WATER_LEVEL_SET to ensure valid value.
          }
        }
        if (message) {
          this.logger.debug(`[${this.name}] Set message:\n${JSON.stringify(message)}`);
          await this.build_send(message);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.stack : err;
      this.logger.debug(`[${this.name}] Error in set_attribute (${this.ip}:${this.port}):\n${msg}`);
    }
  }

  protected set_subtype(): void {
    this.logger.debug('No subtype for A1 (dehumidifier) device');
  }
}
