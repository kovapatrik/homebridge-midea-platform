/***********************************************************************
 * Midea MDV Wi-Fi Controller Device message handler class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */

import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';

export enum HeatStatus {
  Auto = 0x00,
  On = 0x10,
  Off = 0x20,
}

abstract class MessageCCBase extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.MDV_WIFI_CONTROLLER, message_type, body_type, device_protocol_version);
  }
}

export class MessageQuery extends MessageCCBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x01);
  }

  get _body() {
    return Buffer.alloc(23);
  }
}

export class MessageSet extends MessageCCBase {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  power: boolean;
  mode: number;
  fan_speed: number;
  target_temperature: number;
  eco: boolean;
  sleep: boolean;
  display: boolean;
  exhaust: boolean;
  ptc_setting: HeatStatus;
  swing_ud: boolean;
  swing_lr: boolean;
  swing_lr_site: number;
  swing_ud_site: number;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0xc3);
    this.power = false;
    this.mode = 4;
    this.fan_speed = 0x80;
    this.target_temperature = 26;
    this.eco = false;
    this.sleep = false;
    this.display = false;
    this.exhaust = false;
    this.ptc_setting = HeatStatus.Auto;
    this.swing_ud = false;
    this.swing_lr = false;
    this.swing_lr_site = 0;
    this.swing_ud_site = 0;
  }

  get _body() {
    // Byte0: Power | Mode
    const power = this.power ? 0x80 : 0;
    const mode = 1 << (this.mode - 1);
    // Byte1: fan_speed
    const fan_speed = this.fan_speed;
    // Byte2: Integer part of target_temperature
    const temperature_integer = this.target_temperature & 0xff;
    // Byte5: eco | exhaust | swing_ud | ptc_setting
    const eco = this.eco ? 0x01 : 0;
    const ptc_setting = this.ptc_setting & 0x30; // 0x00=Auto, 0x10=On, 0x20=Off
    const swing_ud = this.swing_ud ? 0x04 : 0;
    const exhaust = this.exhaust ? 0x08 : 0;
    // Byte7: sleep | display | swing_lr
    const sleep = this.sleep ? 0x10 : 0;
    const display = this.display ? 0x08 : 0;
    const swing_lr = this.swing_lr ? 0x01 : 0;
    // Byte10: Decimal part of target_temperature (multiplied by 10)
    const temperature_dot = ((this.target_temperature - temperature_integer) * 10) & 0xff;

    // biome-ignore format: easier to read
    return Buffer.from([
      power | mode,
      fan_speed,
      temperature_integer,
      // timer (not supported)
      0x00,
      0x00,
      eco | exhaust | swing_ud | ptc_setting,
      // non-stepless fan speed
      0xFF,
      sleep | display | swing_lr,
      this.swing_lr_site,
      this.swing_ud_site,
      temperature_dot,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ])
  }
}

export class CCGeneralMessageBody extends MessageBody {
  power: boolean;
  mode: number;
  fan_speed: number;
  target_temperature: number;
  indoor_temperature: number;
  evaporator_entrance_temperature: number;
  evaporator_exit_temperature: number;
  eco: boolean;
  sleep: boolean;
  display: boolean;
  exhaust: boolean;
  ptc_setting: HeatStatus;
  ptc_power: boolean;
  control_fan_speed: number;
  temperature_precision: 1 | 0.5;
  swing_ud: boolean;
  swing_lr: boolean;
  swing_ud_site: number;
  swing_lr_site: number;
  error_code: number;
  temp_fahrenheit: boolean;

  constructor(body: Buffer) {
    super(body);
    // Byte 1: power & mode
    this.power = (body[1] & 0x80) > 0;
    const mode_byte = body[1] & 0x1f;
    // Convert bit position to mode number
    this.mode = mode_byte === 0x10 ? 4 : mode_byte === 0x08 ? 3 : mode_byte === 0x04 ? 2 : mode_byte === 0x02 ? 1 : 0;
    // Byte 2: fan_speed
    this.fan_speed = body[2];
    // Byte 3 + Byte 19: target_temperature (integer + decimal)
    this.target_temperature = body[3] + body[19] / 10;
    // Byte 4: indoor_temperature
    this.indoor_temperature = (body[4] - 40) / 2;
    // Byte 5: evaporator_entrance_temperature
    this.evaporator_entrance_temperature = (body[5] - 40) / 2;
    // Byte 6: evaporator_exit_temperature
    this.evaporator_exit_temperature = (body[6] - 40) / 2;
    // Byte 9: swing_ud_site
    this.swing_ud_site = body[9];
    // Byte 13: eco, swing_ud, exhaust, ptc_power, control_fan_speed
    this.eco = (body[13] & 0x01) > 0;
    this.swing_ud = (body[13] & 0x04) > 0;
    this.exhaust = (body[13] & 0x08) > 0;
    this.ptc_power = (body[13] & 0x02) > 0;
    this.control_fan_speed = body[13] & 0xFF; // Control fan speed value (always 0xFF per Lua)
    // Byte 14: ptc_setting, sleep, display, swing_lr, temperature_precision
    const ptc_setting_bits = (body[14] & 0x60) >> 5;
    // Response uses different values: 0=Auto, 1=On, 2=Off (shifted from bits 5-6)
    this.ptc_setting = ptc_setting_bits === 0 ? HeatStatus.Auto : ptc_setting_bits === 1 ? HeatStatus.On : HeatStatus.Off;
    this.sleep = (body[14] & 0x10) > 0;
    this.display = (body[14] & 0x08) > 0;
    this.swing_lr = (body[14] & 0x01) > 0;
    this.temperature_precision = (body[14] & 0x80) > 0 ? 1 : 0.5;
    // Byte 15 & 18: error_code
    const error_low = body[15];
    const error_high = body[18] & 0x7f;
    this.error_code = error_high * 255 + error_low;
    // Byte 17: swing_lr_site
    this.swing_lr_site = body[17];
    // Byte 20: temp_fahrenheit (not in Lua, but doesn't conflict)
    this.temp_fahrenheit = body.length > 20 ? (body[20] & 0x80) > 0 : false;
  }
}

export class MessageCCResponse extends MessageResponse {
  constructor(message: Buffer) {
    super(message);
    if (
      (this.message_type === MessageType.QUERY && this.body_type === 0x01) ||
      ([MessageType.NOTIFY1, MessageType.NOTIFY2].includes(this.message_type) && this.body_type === 0x01) ||
      (this.message_type === MessageType.SET && this.body_type === 0xc3)
    ) {
      this.set_body(new CCGeneralMessageBody(this.body));
    }
  }
}
