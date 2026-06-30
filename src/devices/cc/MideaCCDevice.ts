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
import {
  ControlId,
  FanSpeed,
  FE_FAN_TO_BYTE,
  FE_MODE_TO_BYTE,
  HeatStatus,
  MessageCCResponse,
  MessageFEControl,
  MessageQuery,
  MessageSet,
  Mode,
  PurifierMode,
  SwingAngle,
} from './MideaCCMessage.js';

export interface CCAttributes extends DeviceAttributeBase {
  POWER: boolean;
  MODE: Mode;
  TARGET_TEMPERATURE: number;
  FAN_SPEED: FanSpeed;
  // eco_status
  ECO_MODE: boolean;
  // idu_silent_status
  SILENT_MODE: boolean;
  // idu_sleep_status
  SLEEP_MODE: boolean;
  // digit_display_switch / idu_light
  NIGHT_LIGHT: boolean;
  // wind_swing_ud_site / swing_louver_vertical_level; Close = swing off
  VERTICAL_SWING_ANGLE: SwingAngle;
  // wind_swing_lr_site / swing_louver_horizontal_level; Close = swing off
  HORIZONTAL_SWING_ANGLE: SwingAngle;
  TEMPERATURE_PRECISION: 1 | 0.5;
  INDOOR_TEMPERATURE?: number;
  OUTDOOR_TEMPERATURE?: number;
  // ptc_setting / ptc_status
  AUX_HEAT_MODE: HeatStatus;
  // ptc_enable / ptc power running bit
  AUX_HEAT_RUNNING: boolean;
  // sterilize_status / ion
  PURIFIER_MODE: PurifierMode;
  ERROR_CODE?: number;
  TEMP_FAHRENHEIT: boolean;
}

export default class MideaCCDevice extends MideaDevice {
  public attributes: CCAttributes;

  // Set once a TLV/FE-format response is received; selects the VRF control path.
  private _is_fe_format = false;

  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);

    this.attributes = {
      POWER: false,
      MODE: Mode.Auto,
      TARGET_TEMPERATURE: 26,
      FAN_SPEED: FanSpeed.Auto,
      ECO_MODE: false,
      SILENT_MODE: false,
      SLEEP_MODE: false,
      NIGHT_LIGHT: false,
      AUX_HEAT_MODE: HeatStatus.Auto,
      AUX_HEAT_RUNNING: false,
      PURIFIER_MODE: PurifierMode.Off,
      VERTICAL_SWING_ANGLE: SwingAngle.Close,
      HORIZONTAL_SWING_ANGLE: SwingAngle.Close,
      INDOOR_TEMPERATURE: undefined,
      OUTDOOR_TEMPERATURE: undefined,
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

    const isFEFormat = message.get_body_attribute('is_fe_format');
    if (isFEFormat !== undefined && isFEFormat !== this._is_fe_format) {
      this._is_fe_format = isFEFormat as boolean;
      this.logger.debug(`[${this.name}] Detected ${this._is_fe_format ? 'TLV/FE (86X Controller)' : 'legacy binary'} protocol`);
    }

    const changed: DeviceAttributeBase = {};
    for (const status of Object.keys(this.attributes)) {
      const value = message.get_body_attribute(status.toLowerCase());
      if (value !== undefined) {
        if (this.attributes[status] !== value) {
          this.logger.debug(`[${this.name}] Value for ${status} changed from '${this.attributes[status]}' to '${value}'`);
          changed[status] = value;
        }
        this.attributes[status] = value;
      }
    }

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
    message.aux_heat_mode = this.attributes.AUX_HEAT_MODE;
    message.vertical_swing_angle = this.attributes.VERTICAL_SWING_ANGLE;
    message.horizontal_swing_angle = this.attributes.HORIZONTAL_SWING_ANGLE;
    return message;
  }

  private _make_fe_controls(attributes: Partial<CCAttributes>): [ControlId, number][] {
    const controls: [ControlId, number][] = [];
    for (const [k, v] of Object.entries(attributes)) {
      switch (k) {
        case 'POWER':
          controls.push([ControlId.POWER, v ? 1 : 0]);
          break;
        case 'MODE':
          controls.push([ControlId.MODE, FE_MODE_TO_BYTE[v as Mode] ?? 0x05]);
          break;
        case 'TARGET_TEMPERATURE':
          controls.push([ControlId.TARGET_TEMPERATURE, Math.round((v as number) * 2) + 80]);
          break;
        case 'FAN_SPEED':
          controls.push([ControlId.FAN_SPEED, FE_FAN_TO_BYTE[v as FanSpeed] ?? 0x08]);
          break;
        case 'VERTICAL_SWING_ANGLE':
          controls.push([ControlId.SWING_VERTICAL, v as number]);
          break;
        case 'HORIZONTAL_SWING_ANGLE':
          controls.push([ControlId.SWING_HORIZONTAL, v as number]);
          break;
        case 'ECO_MODE':
          controls.push([ControlId.ECO_MODE, v ? 1 : 0]);
          break;
        case 'SILENT_MODE':
          controls.push([ControlId.SILENT_MODE, v ? 1 : 0]);
          break;
        case 'SLEEP_MODE':
          controls.push([ControlId.SLEEP_MODE, v ? 1 : 0]);
          break;
        case 'NIGHT_LIGHT':
          controls.push([ControlId.NIGHT_LIGHT, v ? 1 : 0]);
          break;
        case 'AUX_HEAT_MODE': {
          const byte = v === HeatStatus.On ? 1 : v === HeatStatus.Off ? 2 : 0;
          controls.push([ControlId.AUX_HEAT_MODE, byte]);
          break;
        }
        case 'PURIFIER_MODE':
          controls.push([ControlId.PURIFIER_MODE, v as number]);
          break;
      }
    }
    return controls;
  }

  async set_attribute(attributes: Partial<CCAttributes>) {
    try {
      const changed: Partial<CCAttributes> = {};
      for (const [k, v] of Object.entries(attributes)) {
        if (v === this.attributes[k]) {
          this.logger.info(`[${this.name}] Attribute ${k} already set to ${v}`);
          continue;
        }
        this.logger.info(`[${this.name}] Set device attribute ${k} to: ${v}`);
        this.attributes[k] = v;
        changed[k] = v;
      }

      if (Object.keys(changed).length === 0) return;

      if (this._is_fe_format) {
        const controls = this._make_fe_controls(changed);
        if (controls.length > 0) {
          this.logger.debug(`[${this.name}] FE controls: ${JSON.stringify(controls)}`);
          await this.build_send(new MessageFEControl(this.device_protocol_version, controls));
        }
      } else {
        const message = this.make_message_set();
        for (const [k, v] of Object.entries(changed)) {
          message[k.toLowerCase()] = v;
        }
        this.logger.debug(`[${this.name}] Set message SET:\n${JSON.stringify(message)}`);
        await this.build_send(message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.stack : err;
      this.logger.debug(`[${this.name}] Error in set_attribute (${this.ip}:${this.port}):\n${msg}`);
    }
  }
}
