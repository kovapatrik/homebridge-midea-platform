import { DeviceType } from '../../core/MideaConstants';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage';

abstract class MessageDBBase extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.FRONT_LOAD_WASHER, message_type, body_type, device_protocol_version);
  }
}

export class MessageQuery extends MessageDBBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x03);
  }

  get _body() {
    return Buffer.alloc(0);
  }
}

export class MessagePower extends MessageDBBase {
  power: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x02);
    this.power = false;
  }

  get _body() {
    const power = this.power ? 0x01 : 0x00;
    return Buffer.from([
      power,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
    ]);
  }
}

export class MessageStart extends MessageDBBase {
  start: boolean;
  washingData: Buffer;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x02);

    this.start = false;
    this.washingData = Buffer.alloc(0);
  }

  get _body() {
    if (this.start) {
      return Buffer.concat([Buffer.from([0xff, 0x01]), this.washingData]);
    } else {
      return Buffer.from([0xff, 0x00]);
    }
  }
}

export class DBGeneralMessageBody extends MessageBody {
  power: boolean;
  start: boolean;
  washingData: Buffer;
  progress: number;
  timeRemaining?: number;

  constructor(body: Buffer) {
    super(body);

    this.power = body[1] > 0;
    this.start = [0x2, 0x6].includes(body[2]);
    this.washingData = body.subarray(3, 16);
    this.progress = 0;
    this.timeRemaining = 0;

    for (let i = 0; i < 7; i++) {
      if ((body[16] & (1 << i)) > 0) {
        this.progress = i + 1;
        break;
      }
    }

    if (this.power) {
      this.timeRemaining = body[17] + (body[18] << 8);
    } else {
      this.timeRemaining = undefined;
    }
  }
}

export class MessageDBResponse extends MessageResponse {
  constructor(message: Buffer) {
    super(message);

    if (
      [MessageType.QUERY, MessageType.SET].includes(this.message_type) ||
      (this.message_type === MessageType.NOTIFY1 && this.body_type === 0x04)
    ) {
      this.set_body(new DBGeneralMessageBody(this.body));
    }
  }
}
