import { LocalSecurity } from './MideaSecurity.js';
import { DateTime } from 'luxon';
import { numberToUint8Array } from './MideaUtils.js';
import { Endianness } from './MideaConstants.js';

export default class PacketBuilder {
  private readonly security: LocalSecurity;
  private packet: Buffer;

  constructor(
    device_id: number,
    private readonly command: Buffer,
  ) {
    this.security = new LocalSecurity();
    this.packet = Buffer.from([
      // 2 bytes - StaicHeader
      0x5a, 0x5a,
      // 2 bytes - mMessageType
      0x01, 0x11,
      // 2 bytes - PacketLenght
      0x00, 0x00,
      // 2 bytes
      0x20, 0x00,
      // 4 bytes - MessageId
      0x00, 0x00, 0x00, 0x00,
      // 8 bytes - Date&Time
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      // 6 bytes - mDeviceID
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      // 12 bytes
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    this.packet.subarray(12, 20).set(PacketBuilder.packet_time());
    this.packet.subarray(20, 28).set(numberToUint8Array(device_id, 8, Endianness.Little));
  }

  public finalize(message_type = 1) {
    if (message_type !== 1) {
      this.packet[3] = 0x10;
      this.packet[6] = 0x7b;
    } else {
      this.packet = Buffer.concat([this.packet, this.security.aes_encrypt(this.command)]);
    }

    this.packet.subarray(4, 6).set(numberToUint8Array(this.packet.length + 16, 2, Endianness.Little));
    this.packet = Buffer.concat([this.packet, this.security.encode32_data(this.packet)]);
    return this.packet;
  }

  public static packet_time() {
    const t = DateTime.utc().toFormat('yyyyMMddHHmmssuu');
    const b = Buffer.alloc(8);
    for (let i = 0; i < t.length; i += 2) {
      b[8 - i - 1] = parseInt(t.substring(i, i + 2));
    }
    return b;
  }

  public static checksum(data: Buffer) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return (~sum + 1) & 0xff;
  }
}
