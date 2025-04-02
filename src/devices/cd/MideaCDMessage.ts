/***********************************************************************
 * Midea Heat Pump Water Heater Device message handler class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */

import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';

abstract class MessageCDBase extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.HEAT_PUMP_WATER_HEATER, message_type, body_type, device_protocol_version);
  }
}

export class MessageQuery extends MessageCDBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x01);
  }

  get _body() {
    return Buffer.from([0x01]);
  }
}

export class MessageSet extends MessageCDBase {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  power: boolean;
  target_temperature: number;
  aux_heating: boolean;
  mode: number;
  tr_temperature: number;
  open_ptc: boolean;
  ptc_temperature: number;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x01);
    this.power = false;
    this.target_temperature = 0;
    this.aux_heating = false;
    this.tr_temperature = 0;
    this.open_ptc = false;
    this.ptc_temperature = 0;
    this.mode = 1;
  }

  get _body() {
    const power = this.power ? 0x01 : 0x00;
    const mode = this.mode + 1;
    const target_temperature = Math.round(this.target_temperature * 2 + 30);

    // biome-ignore format: easier to read
    return Buffer.from([
      0x01, power, mode, target_temperature,
      this.tr_temperature,
      this.open_ptc ? 0x01 : 0x00,
      this.ptc_temperature,
      0x00 // byte8
    ])
  }
}

export class CDGeneralMessageBody extends MessageBody {
  power: boolean;
  target_temperature: number;
  mode: number;
  current_temperature: number;
  condenser_temperature: number;
  outdoor_temperature: number;
  compressor_temperature: number;
  max_temperature: number;
  min_temperature: number;
  compressor_status: boolean;

  constructor(body: Buffer) {
    super(body);

    this.power = (body[2] & 0x01) > 0;
    this.target_temperature = Math.round((body[3] - 30) / 2);
    this.mode = 0;
    if ((body[2] & 0x02) > 0) {
      this.mode = 0;
    } else if ((body[2] & 0x04) > 0) {
      this.mode = 1;
    } else if ((body[2] & 0x08) > 0) {
      this.mode = 2;
    }
    this.current_temperature = Math.round((body[4] - 30) / 2);
    this.condenser_temperature = (body[7] - 30) / 2;
    this.outdoor_temperature = (body[8] - 30) / 2;
    this.compressor_temperature = (body[9] - 30) / 2;
    this.max_temperature = Math.round((body[10] - 30) / 2);
    this.min_temperature = Math.round((body[11] - 30) / 2);
    this.compressor_status = (body[27] & 0x08) > 0;
    if ((body[28] & 0x32) > 0) {
      this.mode = 3;
    }
  }
}

export class CD02MessageBody extends MessageBody {
  power: boolean;
  mode: number;
  target_temperature: number;
  tr_temperature: number;
  open_ptc: boolean;
  ptc_temperature: number;
  byte8: number;

  constructor(body: Buffer) {
    super(body);

    this.power = (body[2] & 0x01) > 0;
    this.mode = body[3];
    this.target_temperature = Math.round((body[4] - 30) / 2);
    this.tr_temperature = body[5];
    this.open_ptc = body[5] === 0x01;
    this.ptc_temperature = body[7];
    this.byte8 = body[8];
  }
}

export class MessageCDResponse extends MessageResponse {
  constructor(message: Buffer) {
    super(message);

    if ([MessageType.QUERY, MessageType.NOTIFY2].includes(this.message_type)) {
      this.set_body(new CDGeneralMessageBody(this.body));
    } else if (MessageType.SET === this.message_type && this.body_type === 0x01) {
      this.set_body(new CD02MessageBody(this.body));
    }
  }
}
