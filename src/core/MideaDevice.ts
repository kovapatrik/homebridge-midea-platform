import { Logger } from 'homebridge';
import { KeyToken, LocalSecurity } from './MideaSecurity';
import { DeviceInfo, DeviceType, TCPMessageType, ProtocolVersion } from './MideaConstants';
import { Socket } from 'net';

export default class MideaDevice {

  private readonly ip: string;
  private readonly port: number;

  private readonly id: number;
  private readonly model: string;
  private readonly sn: string;
  private readonly name: string;
  private readonly type: DeviceType;
  private readonly version: ProtocolVersion;

  public token: KeyToken;
  public key: KeyToken;

  private readonly security: LocalSecurity;

  private readonly socket: Socket;

  constructor(
    private readonly logger: Logger,
    device_info: DeviceInfo,
    token: KeyToken,
    key: KeyToken,
  ) {

    this.ip = device_info.ip;
    this.port = device_info.port;

    this.id = device_info.id;
    this.model = device_info.model;
    this.sn = device_info.sn;
    this.name = device_info.name;
    this.type = device_info.type;
    this.version = device_info.version;

    this.token = token ? Buffer.from(token) : undefined;
    this.key = key ? Buffer.from(key) : undefined;

    this.security = new LocalSecurity();

    this.socket = new Socket();
    this.socket.setTimeout(10000);
    this.socket.connect(this.port, this.ip);
  }

  public async connect() {
    this.logger.debug(`Connecting to device ${this.name} (${this.ip}:${this.port})...`);
    this.socket.connect(this.port, this.ip);

    if (this.version === ProtocolVersion.V3 && !(this.token && this.key)) {
      await this.authenticate();
    }
  }

  private async authenticate() {
    if (!(this.token && this.key)) {
      throw new Error('Token or key is missing!');
    }

    const request = this.security.encode_8370(this.token, TCPMessageType.HANDSHAKE_REQUEST);
    this.logger.debug(`[${this.id}] Handshaking`);
    this.socket.write(request);

    const response: Buffer | null = this.socket.read(512);
    if (response) {
      if (response.length < 20) {
        throw Error(`Authenticate error when receiving data from ${this.ip}:${this.port}.`);
      }
      const resp = response.subarray(8, 72);
      this.security.tcp_key_from_resp(resp, this.key);
    }
  }
}