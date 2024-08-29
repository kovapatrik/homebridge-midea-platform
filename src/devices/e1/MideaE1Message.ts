/***********************************************************************
 * Midea Dishwasher Device message handler class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { DeviceType } from '../../core/MideaConstants';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage';

abstract class MessageE1Base extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.DISHWASHER, message_type, body_type, device_protocol_version);
  }
}

export class MessagePower extends MessageE1Base {
  power: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x08);
    this.power = false;
  }

  get _body() {
    const power = this.power ? 0x01 : 0x00;
    return Buffer.from([power, 0x00, 0x00, 0x00]);
  }
}

export class MessageLock extends MessageE1Base {
  lock: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x83);
    this.lock = false;
  }

  get _body() {
    const lock = this.lock ? 0x03 : 0x04;
    return Buffer.concat([Buffer.from([lock]), Buffer.alloc(36)]);
  }
}

export class MessageStorage extends MessageE1Base {
  storage: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x14);
    this.storage = false;
  }

  get _body() {
    const storage = this.storage ? 0x01 : 0x00;
    return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, storage]), Buffer.alloc(6, 0xff), Buffer.alloc(27)]);
  }
}

export class MessageQuery extends MessageE1Base {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x00);
  }

  get _body() {
    return Buffer.alloc(0);
  }
}

class E1GeneralMessageBody extends MessageBody {
  power: boolean;
  status?: number;
  mode: number;
  additional: number;
  door: boolean;
  rinse_aid: boolean;
  salt: boolean;
  start_pause: boolean;
  start: boolean;
  child_lock: boolean;
  uv: boolean;
  dry: boolean;
  dry_status: boolean;
  storage: boolean;
  storage_status: boolean;
  time_remaining?: number;
  progress?: number;
  storage_remaining?: number;
  temperature?: number;
  humidity?: number;
  waterswitch: boolean;
  water_lack: boolean;
  error_code?: number;
  softwater: number;
  wrong_operation?: number;
  bright?: number;

  constructor(body: Buffer) {
    super(body);
    this.power = body[1] > 0;
    this.status = body[1];
    this.mode = body[2];
    this.additional = body[3];
    this.door = (body[5] & 0x01) === 0; // 0: closed, 1: open
    this.rinse_aid = (body[5] & 0x02) > 0; // 0: enough, 1: shortage
    this.salt = (body[5] & 0x04) > 0; // 0: enough, 1: shortage
    this.start_pause = (body[5] & 0x08) > 0;
    this.start = false;
    if (this.start_pause) {
      this.start = true;
    } else if ([2, 3].includes(this.status)) {
      this.start = false;
    }
    this.child_lock = (body[5] & 0x10) > 0;
    this.uv = (body[4] & 0x2) > 0;
    this.dry = (body[4] & 0x10) > 0;
    this.dry_status = (body[4] & 0x20) > 0;
    this.storage = (body[5] & 0x20) > 0;
    this.storage_status = (body[5] & 0x40) > 0;
    this.time_remaining = body[6];
    this.progress = body[9];
    this.storage_remaining = body.length > 18 ? body[18] : undefined;
    this.temperature = body[11];
    this.humidity = body.length > 33 ? body[33] : undefined;
    this.waterswitch = (body[4] & 0x4) > 0;
    this.water_lack = (body[5] & 0x80) > 0;
    this.error_code = body[10];
    this.softwater = body[13];
    this.wrong_operation = body[16];
    this.bright = body.length > 24 ? body[24] : undefined;
  }
}

export class MessageE1Response extends MessageResponse {
  constructor(message: Buffer) {
    super(message);
    if (
      (this.message_type === MessageType.SET && this.body_type >= 0 && this.body_type <= 7) ||
      ([MessageType.QUERY, MessageType.NOTIFY1].includes(this.message_type) && this.body_type === 0x00)
    ) {
      this.set_body(new E1GeneralMessageBody(this.body));
    }
  }
}
