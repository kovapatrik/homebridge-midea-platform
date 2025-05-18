/***********************************************************************
 * Midea Fresh Air Appliance Device message handler class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */

import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';

abstract class MessageCEBase extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.FRESH_AIR_APPLIANCE, message_type, body_type, device_protocol_version);
  }
}

export class MessageQuery extends MessageCEBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x01);
  }

  get _body() {
    return Buffer.alloc(0);
  }
}

export class MessageSet extends MessageCEBase {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  power: boolean;
  mode: number;
  auto_set_mode: boolean;
  silent_mode: boolean;
  silent_mode_level: number;
  target_temperature: number;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x01);
    this.power = false;
    this.mode = 4; // auto
    this.auto_set_mode = false;
    this.silent_mode = false;
    this.silent_mode_level = 0;
    this.target_temperature = 25;
  }

  get _body() {
    const power = this.power ? 0x01 : 0x00;
    const auto_set_mode = this.auto_set_mode ? 0x02 : 0x00;
    const silent_mode = this.silent_mode ? 0x04 : 0x00;

    // biome-ignore format: easier to read
    return Buffer.from([
       power | auto_set_mode | silent_mode,
       this.mode,
       this.silent_mode_level,
       this.target_temperature
     ]);
  }
}

export class CEGeneralMessageBody extends MessageBody {
  power: boolean;
  auto_set_mode: boolean;
  silent_mode: boolean;
  mode: number;
  silent_mode_level: number;
  target_temperature: number;
  current_temperature: number;
  error_code: number;
  run_mode_under_auto_control: number;

  constructor(body: Buffer) {
    super(body);

    this.power = (body[1] & 0x01) > 0;
    this.auto_set_mode = (body[1] & 0x02) > 0;
    this.silent_mode = (body[1] & 0x04) > 0;
    this.mode = body[2];
    this.silent_mode_level = body[3];
    this.target_temperature = body[4];
    this.current_temperature = body[5] >= 128 ? 256 - body[5] : body[5];
    this.error_code = body[6];
    this.run_mode_under_auto_control = body[7];
  }
}

export class MessageCEResponse extends MessageResponse {
  constructor(message: Buffer) {
    super(message);

    if (([MessageType.QUERY, MessageType.SET].includes(this.message_type) && this.body_type === 0x01) || this.message_type === MessageType.NOTIFY1) {
      this.set_body(new CEGeneralMessageBody(this.body));
    }
  }
}
