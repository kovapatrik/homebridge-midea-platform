import dgram from 'dgram';
import { Logger } from 'homebridge';
import { DISCOVERY_MESSAGE, DeviceInfo, DeviceType, ProtocolVersion } from './MideaConstants';
import { XMLParser } from 'fast-xml-parser';
import { createDecipheriv } from 'crypto';
import EventEmitter from 'events';
import { LocalSecurity } from './MideaSecurity';

export default class Discover extends EventEmitter {

  private readonly IPV4_BROADCAST = '255.255.255.255';
  private socket: dgram.Socket;

  private readonly xml_parser: XMLParser;

  constructor(
    private readonly logger: Logger,
  ) {

    super();

    this.xml_parser = new XMLParser();

    this.socket = dgram.createSocket('udp4');

    this.socket.bind(0, undefined, () => {
      this.socket.setBroadcast(true);
    });

    this.socket.on('error', (err) => {
      this.logger.debug(`server error:\n${err.stack}`);
    });

    this.socket.on('message', async (msg, rinfo) => {

      const device_version = this.getDeviceVersion(msg);
      const device_info = await this.getDeviceInfo(rinfo.address, device_version, msg);
      this.logger.debug(`Discovered device at ${rinfo.address} (${JSON.stringify(device_info)}).`);

      this.emit('device', device_info);
    });

  }

  public startDiscover() {

    for (const port of [6445, 20086]) {
      this.socket.send(Buffer.from(DISCOVERY_MESSAGE), port, this.IPV4_BROADCAST, (err) => {
        if (err) {
          this.logger.error(`Error while sending message to ${this.IPV4_BROADCAST}:${port}: ${err}`);
        }
      });
    }
  }

  private getDeviceVersion(data: Buffer) {
    try {
      this.xml_parser.parse(data.toString(), true);
      return ProtocolVersion.V1;
    } catch {
      const start_of_packet = data.subarray(0, 2);

      if (start_of_packet.compare(Buffer.from([0x5a, 0x5a])) === 0) {
        return ProtocolVersion.V2;
      } else if (start_of_packet.compare(Buffer.from([0x83, 0x70])) === 0) {
        return ProtocolVersion.V3;
      }
    }

    throw new Error('Unknown device version.');
  }

  private async getDeviceInfo(ip: string, version: ProtocolVersion, data: Buffer) : Promise<DeviceInfo> {
    if (version === ProtocolVersion.V1) {
      // const root = this.xml_parser.parse(data.toString());
      // const device = root["body"]["device"]

      // if (device) {
      //   const port = device["port"];
      // }

      // throw new Error("Could not find 'body/device' in XML.");

      throw new Error('Version 1 not implemented.');

    } else {
      let buffer = data;
      // Strip V3 header and hash
      if (version === ProtocolVersion.V3) {
        buffer = buffer.subarray(8, -16);
      }

      const encrypted_data = buffer.subarray(40, -16);
      const device_id = buffer.readUIntLE(20, 6);


      const cipher = createDecipheriv('aes-128-ecb', LocalSecurity.ENC_KEY, null);
      let decrypted_buffer: Buffer;

      try {
        decrypted_buffer = cipher.update(encrypted_data);
        decrypted_buffer = Buffer.concat([decrypted_buffer, cipher.final()]);
      } catch (err) {
        throw new Error(`Error while decrypting data: ${err}`);
      }

      this.logger.debug(`Decrypted data: ${decrypted_buffer.toString('hex')}`);

      // eslint-disable-next-line max-len
      const ip_address = `${decrypted_buffer.readUint8(3)}.${decrypted_buffer.readUint8(2)}.${decrypted_buffer.readUint8(1)}.${decrypted_buffer.readUint8(0)}`;
      const port = decrypted_buffer.readUIntLE(4, 2);

      if (ip_address !== ip) {
        this.logger.warn(`IP address mismatch: ${ip_address} != ${ip}`);
      }

      const model = decrypted_buffer.subarray(17, 25).toString();

      // Serial number
      const sn = decrypted_buffer.subarray(8, 40).toString();

      // Extract name/SSID
      const name_length = decrypted_buffer.readUIntLE(40, 1);
      const name = decrypted_buffer.subarray(41, 41 + name_length).toString();

      const device_type = Number(`0x${name.split('_')[1]}`);

      return {
        'ip': ip_address,
        'port': port,
        'id': device_id,
        'model': model,
        'sn': sn,
        'name': name,
        'type': DeviceType[device_type as unknown as keyof typeof DeviceType],
        'version': ProtocolVersion[version as unknown as keyof typeof ProtocolVersion],
      };
    }
  }

  // TODO: Implement device classes, now only using AC
  // private async getDevice(ip: string, version: ProtocolVersion, data: Buffer) {
  //   try {
  //     const device_info = await this.getDeviceInfo(ip, version, data);

  //     switch (device_info.type) {
  //       case DeviceType.AIR_CONDITIONER:
  //         return new AirConditioner(device_info, this.logger);
  //     }
  //   } catch (err) {
  //     this.logger.error(`Error while getting device info: ${err}`);
  //   }
  // }

}