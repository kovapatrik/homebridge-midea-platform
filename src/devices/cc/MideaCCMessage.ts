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
  X10 = 1,
  X20 = 2,
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
  eco_mode: boolean;
  sleep_mode: boolean;
  night_light: boolean;
  ventilation: boolean;
  aux_heat_status: number;
  auto_aux_heat_running: boolean;
  swing: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0xc3);
    this.power = false;
    this.mode = 4;
    this.fan_speed = 0x80;
    this.target_temperature = 26;
    this.eco_mode = false;
    this.sleep_mode = false;
    this.night_light = false;
    this.ventilation = false;
    this.aux_heat_status = 0;
    this.auto_aux_heat_running = false;
    this.swing = false;
  }

  get _body() {
    // Byte1, Power Mode
    const power = this.power ? 0x80 : 0;
    const mode = 1 << (this.mode - 1);
    // Byte2 fan_speed
    const fan_speed = this.fan_speed;
    // Byte3 Integer of target_temperature
    const temperature_integer = this.target_temperature & 0xff;
    // Byte6 eco_mode ventilation aux_heating
    const eco_mode = this.eco_mode ? 0x01 : 0;
    const aux_heating = this.aux_heat_status === HeatStatus.X10 ? 0x10 : this.aux_heat_status === HeatStatus.X20 ? 0x20 : 0;
    const swing = this.swing ? 0x04 : 0;
    const ventilation = this.ventilation ? 0x08 : 0;
    // Byte8 sleep_mode night_light
    const sleep_mode = this.sleep_mode ? 0x10 : 0;
    const night_light = this.night_light ? 0x08 : 0;
    // Byte11 Dot of target_temperature
    const temperature_dot = ((this.target_temperature - temperature_integer) * 10) & 0xff;

    // biome-ignore format: easier to read
    return Buffer.from([
      power | mode,
      fan_speed,
      temperature_integer,
      // timer
      0x00,
      0x00,
      eco_mode | ventilation | swing | aux_heating,
      // non-stepless fan speed
      0xFF,
      sleep_mode | night_light,
      0x00,
      0x00,
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
  eco_mode: boolean;
  sleep_mode: boolean;
  night_light: boolean;
  ventilation: boolean;
  aux_heat_status: number;
  auto_aux_heat_running: boolean;
  fan_speed_level: boolean;
  temperature_precision: 1 | 0.5;
  swing: boolean;
  temp_fahrenheit: boolean;

  constructor(body: Buffer) {
    super(body);
    this.power = (body[1] & 0x80) > 0;
    let mode = body[1] & 0x1f;
    this.mode = 0;
    while (mode >= 1) {
      mode /= 2;
      this.mode += 1;
    }
    this.fan_speed = body[2];
    this.target_temperature = body[3] + body[19] / 10;
    this.indoor_temperature = (body[4] - 40) / 2;
    this.eco_mode = (body[13] & 0x01) > 0;
    this.sleep_mode = (body[14] & 0x10) > 0;
    this.night_light = (body[14] & 0x08) > 0;
    this.ventilation = (body[13] & 0x08) > 0;
    this.aux_heat_status = (body[14] & 0x60) >> 5;
    this.auto_aux_heat_running = (body[13] & 0x02) > 0;
    this.fan_speed_level = (body[13] & 0x40) > 0;
    this.temperature_precision = (body[14] & 0x80) > 0 ? 1 : 0.5;
    this.swing = (body[13] & 0x04) > 0;
    this.temp_fahrenheit = (body[20] & 0x80) > 0;
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
