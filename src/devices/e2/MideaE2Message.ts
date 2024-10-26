/***********************************************************************
 * Midea Electric Water Heater Device message handler class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { DeviceType } from '../../core/MideaConstants';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage';

abstract class MessageE2Base extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.ELECTRIC_WATER_HEATER, message_type, body_type, device_protocol_version);
  }
}

export class MessageQuery extends MessageE2Base {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x01);
  }

  get _body() {
    return Buffer.from([0x01]);
  }
}

export class MessagePower extends MessageE2Base {
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

export class MessageNewProtocolSet extends MessageE2Base {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
  target_temperature?: number;
  variable_heating?: boolean;
  whole_tank_heating?: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x02);
  }

  get _body() {
    let byte1 = 0x00;
    let byte2 = 0x00;
    if (this.target_temperature !== undefined) {
      byte1 = 0x07;
      byte2 = (this.target_temperature | 0) & 0xf;
    } else if (this.whole_tank_heating !== undefined) {
      byte1 = 0x04;
      byte2 = this.whole_tank_heating ? 0x02 : 0x01;
    } else if (this.variable_heating !== undefined) {
      byte1 = 0x10;
      byte2 = this.variable_heating ? 0x01 : 0x00;
    }
    return Buffer.from([byte1, byte2]);
  }
}

export class MessageSet extends MessageE2Base {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
  target_temperature: number;
  variable_heating: boolean;
  whole_tank_heating: boolean;
  protection: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x02);
    this.target_temperature = 0;
    this.variable_heating = false;
    this.whole_tank_heating = false;
    this.protection = false;
  }

  get _body() {
    const protection = this.protection ? 0x04 : 0x00;
    const whole_tank_heating = this.whole_tank_heating ? 0x02 : 0x01;
    const target_temperature = this.target_temperature & 0xff;
    const variable_heating = this.variable_heating ? 0x10 : 0x00;
    return Buffer.from([
      0x01,
      0x00,
      0x80,
      whole_tank_heating | protection,
      target_temperature,
      0x00,
      0x00,
      0x00,
      variable_heating,
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

class E2GeneralMessageBody extends MessageBody {
  power: boolean;
  heating: boolean;
  keep_warm: boolean;
  variable_heating: boolean;
  current_temperature: number;
  whole_tank_heating: boolean;
  heating_time_remaining: number;
  target_temperature: number;
  protection: boolean;
  water_consumption?: number;
  heating_power?: number;

  constructor(body: Buffer) {
    super(body);
    this.power = (body[2] & 0x01) > 0;
    this.heating = (body[2] & 0x04) > 0;
    this.keep_warm = (body[2] & 0x08) > 0;
    this.variable_heating = (body[2] & 0x80) > 0;
    this.current_temperature = body[4];
    this.whole_tank_heating = (body[7] & 0x08) > 0;
    this.heating_time_remaining = body[9] * 60 + body[10];
    this.target_temperature = body[11];
    this.protection = body.length > 22 ? (body[22] & 0x02) > 0 : false;
    if (body.length > 25) {
      this.water_consumption = body[24] + (body[25] << 8);
    }
    if (body.length > 34) {
      this.heating_power = body[34] * 100;
    }
  }
}

export class MessageE2Response extends MessageResponse {
  constructor(message: Buffer) {
    super(message);
    if (
      ([MessageType.QUERY, MessageType.NOTIFY1].includes(this.message_type) && this.body_type === 0x01) ||
      (this.message_type === MessageType.SET && [0x01, 0x02, 0x04, 0x14].includes(this.body_type))
    ) {
      this.set_body(new E2GeneralMessageBody(this.body));
    }
  }
}
