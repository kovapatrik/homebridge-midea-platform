/***********************************************************************
 * Midea Gas Water Heater Device message handler class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { DeviceType } from '../../core/MideaConstants';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage';

export enum NewProtocolTags {
  ZERO_COLD_WATER = 0x03,
  ZERO_COLD_PULSE = 0x04,
  SMART_VOLUME = 0x07,
  TARGET_TEMPERATURE = 0x08,
}

abstract class MessageE3Base extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.GAS_WATER_HEATER, message_type, body_type, device_protocol_version);
  }
}

export class MessageQuery extends MessageE3Base {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x01);
  }

  get _body() {
    return Buffer.from([0x01]);
  }
}

export class MessagePower extends MessageE3Base {
  power: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x02);
    this.power = false;
  }

  get _body() {
    if (this.power) {
      this.body_type = 0x01;
    } else {
      this.body_type = 0x02;
    }
    return Buffer.from([0x01]);
  }
}

export class MessageSet extends MessageE3Base {
  target_temperature: number;
  zero_cold_water: boolean;
  bathtub_volume: number;
  protection: boolean;
  zero_cold_pulse: boolean;
  smart_volume: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x04);
    this.target_temperature = 0;
    this.zero_cold_water = false;
    this.bathtub_volume = 0;
    this.protection = false;
    this.zero_cold_pulse = false;
    this.smart_volume = false;
  }

  get _body() {
    // Byte 2 zero_cold_water mode
    const zero_cold_water = this.zero_cold_water ? 0x01 : 0x00;
    // Byte 3
    const protection = this.protection ? 0x08 : 0x00;
    const zero_cold_pulse = this.zero_cold_pulse ? 0x10 : 0x00;
    const smart_volume = this.smart_volume ? 0x20 : 0x00;
    // Byte 5
    const target_temperature = this.target_temperature & 0xff;

    return Buffer.from([
      0x01,
      zero_cold_water | 0x02,
      protection | zero_cold_pulse | smart_volume,
      0x00,
      target_temperature,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);
  }
}

export class MessageNewProtocolSet extends MessageE3Base {
  key?: keyof typeof NewProtocolTags;
  value?: number | boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x14);
  }

  get _body() {
    if (this.key === undefined || this.value === undefined) {
      throw new Error('key and value must be set');
    }
    const key = NewProtocolTags[this.key];
    if (key === undefined) {
      throw new Error('Invalid key');
    }
    let value: number;
    if (this.key === 'TARGET_TEMPERATURE') {
      value = this.value as number;
    } else {
      value = this.value ? 0x01 : 0x00;
    }
    return Buffer.from([key, value, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }
}

export class E3GeneralMessageBody extends MessageBody {
  power: boolean;
  burning_state: boolean;
  zero_cold_water: boolean;
  current_temperature: number;
  target_temperature: number;
  protection: boolean;
  zero_cold_pulse: boolean;
  smart_volume: boolean;

  constructor(body: Buffer) {
    super(body);
    this.power = (body[2] & 0x01) > 0;
    this.burning_state = (body[2] & 0x02) > 0;
    this.zero_cold_water = (body[2] & 0x04) > 0;
    this.current_temperature = body[5];
    this.target_temperature = body[6];
    this.protection = (body[8] & 0x08) > 0;
    this.zero_cold_pulse = body.length > 20 ? (body[20] & 0x01) > 0 : false;
    this.smart_volume = body.length > 20 ? (body[20] & 0x02) > 0 : false;
  }
}

export class MessageE3Response extends MessageResponse {
  constructor(message: Buffer) {
    super(message);
    if (
      (this.message_type === MessageType.QUERY && this.body_type === 0x01) ||
      (this.message_type === MessageType.SET && [0x01, 0x02, 0x04, 0x14].includes(this.body_type)) ||
      (this.message_type === MessageType.NOTIFY1 && [0x00, 0x01].includes(this.body_type))
    ) {
      this.set_body(new E3GeneralMessageBody(this.body));
    }
  }
}
