/***********************************************************************
 * Midea Heat Pump WiFi Controller Device message handler class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';

abstract class MessageC3Base extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.HEAT_PUMP_WIFI_CONTROLLER, message_type, body_type, device_protocol_version);
  }
}

export class MessageQuery extends MessageC3Base {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x01);
  }

  get _body() {
    return Buffer.alloc(0);
  }
}

export class MessageSet extends MessageC3Base {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
  zone1_power: boolean;
  zone2_power: boolean;
  dhw_power: boolean;
  mode: number;
  zone_target_temperature: number[];
  dhw_target_temperature: number;
  room_target_temperature: number;
  zone1_curve: boolean;
  zone2_curve: boolean;
  disinfect: boolean;
  fast_dhw: boolean;
  tbh: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x01);
    this.zone1_power = false;
    this.zone2_power = false;
    this.dhw_power = false;
    this.mode = 0;
    this.zone_target_temperature = [25, 25];
    this.dhw_target_temperature = 40;
    this.room_target_temperature = 25;
    this.zone1_curve = false;
    this.zone2_curve = false;
    this.disinfect = false;
    this.fast_dhw = false;
    this.tbh = false;
  }

  get _body() {
    // Byte 1
    const zone1_power = this.zone1_power ? 0x01 : 0x00;
    const zone2_power = this.zone2_power ? 0x02 : 0x00;
    const dhw_power = this.dhw_power ? 0x04 : 0x00;
    // Byte 7
    const zone1_curve = this.zone1_curve ? 0x01 : 0x00;
    const zone2_curve = this.zone2_curve ? 0x02 : 0x00;
    const disinfect = this.disinfect || this.tbh ? 0x04 : 0x00;
    const fast_dhw = this.fast_dhw ? 0x08 : 0x00;

    const room_target_temperature = (this.room_target_temperature * 2) | 0;
    const zone1_target_temperature = this.zone_target_temperature[0] | 0;
    const zone2_target_temperature = this.zone_target_temperature[1] | 0;
    const dhw_target_temperature = this.dhw_target_temperature | 0;
    return Buffer.from([
      zone1_power | zone2_power | dhw_power,
      this.mode,
      zone1_target_temperature,
      zone2_target_temperature,
      dhw_target_temperature,
      room_target_temperature,
      zone1_curve | zone2_curve | disinfect | fast_dhw,
    ]);
  }
}

export class MessageSetSilent extends MessageC3Base {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
  silent_mode: boolean;
  super_silent: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x05);
    this.silent_mode = false;
    this.super_silent = false;
  }

  get _body() {
    const silent_mode = this.silent_mode ? 0x01 : 0x00;
    const super_silent = this.super_silent ? 0x02 : 0x00;

    return Buffer.from([silent_mode | super_silent, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }
}

export class MessageSetECO extends MessageC3Base {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
  eco_mode: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x07);
    this.eco_mode = false;
  }

  get _body() {
    const eco_mode = this.eco_mode ? 0x01 : 0x00;

    return Buffer.from([eco_mode, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }
}

export class C3MessageBody extends MessageBody {
  zone1_power: boolean;
  zone2_power: boolean;
  dhw_power: boolean;
  zone1_curve: boolean;
  zone2_curve: boolean;
  disinfect: boolean;
  tbh: boolean;
  fast_dhw: boolean;
  zone_temperature_type: boolean[];
  silent_mode: boolean;
  eco_mode: boolean;
  mode: number;
  mode_auto: number;
  zone_target_temp: number[];
  dhw_target_temp: number;
  room_target_temp: number;
  zone_heating_temperature_max: number[];
  zone_heating_temperature_min: number[];
  zone_cooling_temperature_max: number[];
  zone_cooling_temperature_min: number[];
  room_temperature_max: number;
  room_temperature_min: number;
  dhw_temperature_max: number;
  dhw_temperature_min: number;
  tank_actual_temperature: number;
  error_code: number;

  constructor(body: Buffer, data_offset = 0) {
    super(body);
    this.zone1_power = (body[data_offset + 0] & 0x01) > 0;
    this.zone2_power = (body[data_offset + 0] & 0x02) > 0;
    this.dhw_power = (body[data_offset + 0] & 0x04) > 0;
    this.zone1_curve = (body[data_offset + 0] & 0x08) > 0;
    this.zone2_curve = (body[data_offset + 0] & 0x10) > 0;
    this.disinfect = (body[data_offset + 0] & 0x20) > 0;
    this.tbh = (body[data_offset + 0] & 0x20) > 0;
    this.fast_dhw = (body[data_offset + 0] & 0x40) > 0;
    this.zone_temperature_type = [(body[data_offset + 1] & 0x10) > 0, (body[data_offset + 1] & 0x20) > 0];
    this.silent_mode = (body[data_offset + 2] & 0x02) > 0;
    this.eco_mode = (body[data_offset + 2] & 0x08) > 0;
    this.mode = body[data_offset + 3];
    this.mode_auto = body[data_offset + 4];
    this.zone_target_temp = [body[data_offset + 5], body[data_offset + 6]];
    this.dhw_target_temp = body[data_offset + 7];
    this.room_target_temp = body[data_offset + 8] / 2;
    this.zone_heating_temperature_max = [body[data_offset + 9], body[data_offset + 13]];
    this.zone_heating_temperature_min = [body[data_offset + 10], body[data_offset + 14]];
    this.zone_cooling_temperature_max = [body[data_offset + 11], body[data_offset + 15]];
    this.zone_cooling_temperature_min = [body[data_offset + 12], body[data_offset + 16]];
    this.room_temperature_max = body[data_offset + 17] / 2;
    this.room_temperature_min = body[data_offset + 18] / 2;
    this.dhw_temperature_max = body[data_offset + 19];
    this.dhw_temperature_min = body[data_offset + 20];
    this.tank_actual_temperature = body[data_offset + 21];
    this.error_code = body[data_offset + 22];
  }
}

export class C3Notify1MessageBody extends MessageBody {
  status_tbh: boolean;
  status_dhw: boolean;
  status_ibh: boolean;
  status_heating: boolean;
  total_energy_consumption: number;
  total_produced_energy: number;
  outdoor_temperature: number;

  constructor(body: Buffer, data_offset = 0) {
    super(body);
    const status_byte = body[data_offset];
    this.status_tbh = (status_byte & 0x08) > 0;
    this.status_dhw = (status_byte & 0x04) > 0;
    this.status_ibh = (status_byte & 0x02) > 0;
    this.status_heating = (status_byte & 0x01) > 0;

    this.total_energy_consumption = body.readUInt32LE(data_offset + 1);
    this.total_produced_energy = body.readUInt32LE(data_offset + 5);
    this.outdoor_temperature = body[data_offset + 9] | 0;
  }
}

export class MessageC3Response extends MessageResponse {
  constructor(message: Buffer) {
    super(message);
    if (
      ([MessageType.SET, MessageType.NOTIFY1, MessageType.QUERY].includes(this.message_type) && this.body_type === 0x01) ||
      this.message_type === MessageType.NOTIFY2
    ) {
      this.set_body(new C3MessageBody(this.body, 1));
    } else if (this.message_type === MessageType.NOTIFY1 && this.body_type === 0x04) {
      this.set_body(new C3Notify1MessageBody(this.body, 1));
    }
  }
}
