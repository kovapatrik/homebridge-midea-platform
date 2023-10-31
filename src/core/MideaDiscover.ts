/***********************************************************************
 * Midea device discovery class where we broadcast to network to find
 * connected devices.
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Portions Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import dgram from 'dgram';
import { Logger } from 'homebridge';
import { DISCOVERY_MESSAGE, DeviceInfo, ProtocolVersion } from './MideaConstants';
import { XMLParser } from 'fast-xml-parser';
import EventEmitter from 'events';
import { LocalSecurity } from './MideaSecurity';

// To access network interface detail...
import os from 'os';

export default class Discover extends EventEmitter {
  private socket: dgram.Socket;

  private readonly xml_parser: XMLParser;
  private security: LocalSecurity;
  private ips: string[] = [];

  constructor(private readonly logger: Logger | undefined) {
    super();

    this.security = new LocalSecurity();
    this.xml_parser = new XMLParser();

    this.socket = dgram.createSocket('udp4');

    this.socket.bind(0, undefined, () => {
      this.socket.setBroadcast(true);
    });

    this.socket.on('error', (err) => {
      this.logger?.debug(`server error:\n${err.stack}`);
    });

    // Register callback function executed when message received on the socket as
    // result of sending broadcast messages out to network / IP address.
    this.socket.on('message', async (msg, rinfo) => {
      if (!this.ips.includes(rinfo.address)) {
        // Only add device if it has not already been added.
        this.ips.push(rinfo.address);

        const device_version = this.getDeviceVersion(msg);
        const device_info = await this.getDeviceInfo(rinfo.address, device_version, msg);
        this.logger?.info(`Discovered device: ${JSON.stringify(device_info)}`);

        // Send signal to Homebridge platform with details on the discovered device
        this.emit('device', device_info);
      }
    });
  }

  /*********************************************************************
   * discoverDeviceByIP
   * Sends discover message to a single IP address.  Will resend the message
   * an additional "retries" times spaced by 3 seconds if the target IP
   * address has not responded (recorded in the above callback).
   */
  public discoverDeviceByIP(ip: string, retries = 3) {
    let tries = 0;
    const interval = setInterval(() => {
      if (this.ips.includes(ip) || tries++ > retries) {
        clearInterval(interval);
        return;
      }
      this.logger?.debug(`Sending discovery message to ${ip}, try ${tries}...`);
      for (const port of [6445, 20086]) {
        this.socket.send(Buffer.from(DISCOVERY_MESSAGE), port, ip, (err) => {
          if (err) {
            this.logger?.error(`Error while sending message to ${ip}: ${err}`);
          }
        });
      }
    }, 3000);
  }

  /*********************************************************************
   * ifBroadcastAddrs
   * Broadcasts to 255.255.255.255 only gets sent out on the first network inteface.
   * This function finds all network interfaces and returns the broadcast address
   * for each in an array, e.g. ['192.168.1.255', '192.168.100.255'].  If there are
   * multiple interfaces this will cause broadcast to be sent out on each interface
   * so all appliances are properly discovered.
   */
  private ifBroadcastAddrs(): string[] {
    const list: string[] = [];
    try {
      const ifaces = os.networkInterfaces();
      for (const iface of Object.values(ifaces)) {
        if (iface) {
          for (const f of iface) {
            if (!f.internal && f.family === 'IPv4') {
              // With thanks to https://github.com/aal89/broadcast-address/blob/master/broadcast-address.js
              const addr_splitted = f.address.split('.');
              const netmask_splitted = f.netmask.split('.');
              // Bitwise OR over the splitted NAND netmask, then glue them back together with a dot character to form an ip
              // we have to do a NAND operation because of the 2-complements; getting rid of all the 'prepended' 1's with & 0xFF
              const broadcast = addr_splitted.map((e, i) => (~netmask_splitted[i] & 0xff) | Number.parseInt(e)).join('.');
              list.push(broadcast);
            }
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.stack : e;
      this.logger?.error(`Fatal error during plugin initialization:\n${msg}`);
    }
    // this.logger?.info(`Broadcast addresses: ${JSON.stringify(list)}`);
    return list;
  }

  /*********************************************************************
   * startDiscover
   * Sends broadcast to network discover Midea devices. Will continue sending
   * up to an additional "retries" times each spaced by 3 seconds.
   */
  public startDiscover(retries = 3) {
    let tries = 0;
    const broadcastAddrs = this.ifBroadcastAddrs();

    const interval = setInterval(() => {
      if (tries++ > retries) {
        clearInterval(interval);
        this.logger?.info(`Device discovery complete after ${retries + 1} network broadcasts.`);
        this.emit('complete');
        return;
      }
      for (const ip of broadcastAddrs) {
        this.logger?.debug(`Sending discovery message to ${ip}, try ${tries}...`);
        for (const port of [6445, 20086]) {
          this.socket.send(Buffer.from(DISCOVERY_MESSAGE), port, ip, (err) => {
            if (err) {
              const msg = err instanceof Error ? err.stack : err;
              this.logger?.error(`Error while sending message to ${ip}:${port}:\n${msg}`);
            }
          });
        }
      }
    }, 3000);
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

  private async getDeviceInfo(ip: string, version: ProtocolVersion, data: Buffer): Promise<DeviceInfo> {
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

      let decrypted_buffer: Buffer;
      try {
        decrypted_buffer = this.security.aes_decrypt(encrypted_data);
      } catch (err) {
        throw new Error(`Error while decrypting data: ${err}`);
      }

      // prettier-ignore
      // eslint-disable-next-line max-len
      const ip_address = `${decrypted_buffer.readUint8(3)}.${decrypted_buffer.readUint8(2)}.${decrypted_buffer.readUint8(1)}.${decrypted_buffer.readUint8(0)}`;
      const port = decrypted_buffer.readUIntLE(4, 2);

      if (ip_address !== ip) {
        this.logger?.warn(`IP address mismatch: ${ip_address} != ${ip}`);
      }

      const model = decrypted_buffer.subarray(17, 25).toString();

      // Serial number
      const sn = decrypted_buffer.subarray(8, 40).toString();

      // Extract name/SSID
      const name_length = decrypted_buffer.readUIntLE(40, 1);
      const name = decrypted_buffer.subarray(41, 41 + name_length).toString();

      const device_type = Number(`0x${name.split('_')[1]}`);

      return {
        ip: ip,
        port: port,
        id: device_id,
        model: model,
        sn: sn,
        name: name,
        type: device_type,
        version: version,
      };
    }
  }

  // TODO: Implement device classes, now only using AC
  // private async getDevice(ip: string, version: ProtocolVersion, data: Buffer) {
  //   try {
  //     const device_info = await this.getDeviceInfo(ip, version, data);

  //     switch (device_info.type) {
  //       case DeviceType.AIR_CONDITIONER:
  //         return new AirConditioner(device_info, this.logger?);
  //     }
  //   } catch (err) {
  //     this.logger?.error(`Error while getting device info: ${err}`);
  //   }
  // }
}
