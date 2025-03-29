/***********************************************************************
 * Midea Humidifier Device message handler class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';

abstract class MessageFDBase extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number | null) {
    super(DeviceType.HUMIDIFIER, message_type, body_type, device_protocol_version);
  }
}

export class MessageQuery extends MessageFDBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x41);
  }

  get _body() {
    // biome-ignore format: easier to read
    return Buffer.from([
      0x81, 0x00, 0xff, 0x03,
      0x00, 0x00, 0x02, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00
		]);
  }
}

export class MessageSet extends MessageFDBase {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;

  power: boolean;
  fan_speed: number;
  target_humidity: number;
  prompt_tone: boolean;
  screen_display: number;
  mode: number;
  disinfect?: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x48);
    this.power = false;
    this.fan_speed = 0;
    this.target_humidity = 50;
    this.prompt_tone = false;
    this.screen_display = 0x07;
    this.mode = 0x01;
    this.disinfect = undefined;
  }

  get _body() {
    const power = this.power ? 0x01 : 0x00;
    const prompt_tone = this.prompt_tone ? 0x40 : 0x00;
    const disinfect = this.disinfect === undefined ? 0x00 : this.disinfect ? 0x01 : 0x02;
    // biome-ignore format: easier to read
    return Buffer.from([
			power | prompt_tone | 0x02,
			0x00,
			this.fan_speed,
			0x00, 0x00, 0x00,
			this.target_humidity,
			0x00,
			this.screen_display,
			this.mode,
			0x00, 0x00, 0x00, 0x00,
			disinfect,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00,
		]);
  }
}

export class FDC8MessageBody extends MessageBody {
  power: boolean;
  fan_speed: number;
  target_humidity: number;
  current_humidity: number;
  current_temperature: number;
  tank: number;
  mode: number;
  screen_display: number;
  disinfect?: boolean;

  constructor(body: Buffer) {
    super(body);
    this.power = (body[1] & 0x01) > 0;
    this.fan_speed = body[3] & 0x7f;
    this.target_humidity = body[7];
    this.current_humidity = body[16];
    this.current_temperature = (body[17] - 50) / 2;
    this.tank = body[10];
    this.mode = (body[8] & 0x70) >> 4;
    this.screen_display = body[9] & 0x07;
    if (body.length > 36) {
      const disinfect = body[34] & 0x03;
      this.disinfect = disinfect === 0x01;
    }
  }
}

export class FDA0MessageBody extends MessageBody {
  power: boolean;
  fan_speed: number;
  target_humidity: number;
  current_humidity: number;
  current_temperature: number;
  tank: number;
  mode: number;
  screen_display: number;
  disinfect?: boolean;

  constructor(body: Buffer) {
    super(body);
    this.power = (body[1] & 0x01) > 0;
    this.fan_speed = body[3] & 0x7f;
    this.target_humidity = body[7];
    this.current_humidity = body[16];
    this.current_temperature = (body[17] - 50) / 2;
    this.tank = body[10];
    this.mode = body[10] & 0x07;
    this.screen_display = body[9] & 0x07;
    if (body.length > 29) {
      const disinfect = body[27] & 0x03;
      this.disinfect = disinfect === 0x01;
    }
  }
}

export class MessageFDResponse extends MessageResponse {
  constructor(message: Buffer) {
    super(message);
    if ([MessageType.QUERY, MessageType.SET, MessageType.NOTIFY1].includes(this.message_type)) {
      if (this.body_type === 0xc8) {
        this.set_body(new FDC8MessageBody(this.body));
      } else if (this.body_type === 0xa0) {
        this.set_body(new FDA0MessageBody(this.body));
      }
    }
  }
}
