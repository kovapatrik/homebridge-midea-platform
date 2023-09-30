import { Logger } from 'homebridge';
import { KeyToken, LocalSecurity } from './MideaSecurity';
import { DeviceInfo, DeviceType, TCPMessageType, ProtocolVersion, ParseMessageResult } from './MideaConstants';
import { MessageQuerySubtype, MessageQuestCustom, MessageRequest, MessageSubtypeResponse, MessageType } from './MideaMessage';
import PacketBuilder from './MideaPacketBuilder';
import { PromiseSocket } from './MideaUtils';
import { Config } from '../platformUtils';

export type DeviceAttributeBase = {
  [key: string]: number | string | boolean | undefined;
};

export default abstract class MideaDevice {

  private readonly SOCKET_TIMEOUT = 3000;

  public readonly ip: string;
  protected readonly port: number;

  public readonly id: number;
  public readonly model: string;
  public readonly sn: string;
  public readonly name: string;
  public readonly type: DeviceType;
  protected readonly version: ProtocolVersion;

  protected is_running = false;
  protected available = false;

  private unsupported_protocol: string[] = [];
  protected device_protocol_version = 0;

  protected refresh_interval = 30 * 1000;
  protected heartbeat_interval = 10 * 1000;
  protected default_refresh_interval = 30 * 1000;
  protected verbose = undefined;

  private _sub_type?: number;

  public token: KeyToken;
  public key: KeyToken;

  private update_fns: { (values: DeviceAttributeBase): void; }[] = [];

  protected readonly security: LocalSecurity;
  private buffer: Buffer;

  private promiseSocket: PromiseSocket;

  public abstract attributes: DeviceAttributeBase;


  protected abstract build_query(): MessageRequest[];
  protected abstract process_message(message: Buffer): void;
  protected abstract set_subtype(): void;
  public abstract set_attribute(status: DeviceAttributeBase): Promise<void>;

  constructor(
    protected readonly logger: Logger,
    device_info: DeviceInfo,
    token: KeyToken,
    key: KeyToken,
    config: Config | undefined = undefined
  ) {

    this.ip = device_info.ip;
    this.port = device_info.port;

    this.id = device_info.id;
    this.model = device_info.model;
    this.sn = device_info.sn;
    this.name = device_info.name;
    this.type = device_info.type;
    this.version = device_info.version;

    this.token = token;
    this.key = key;

    this.verbose = config?.verbose;

    this.security = new LocalSecurity();
    this.buffer = Buffer.alloc(0);

    this.promiseSocket = new PromiseSocket();
  }

  get sub_type(): number {
    return this._sub_type || 0;
  }

  public fetch_v2_message(message: Buffer): [Buffer[], Buffer] {
    const result: Buffer[] = [];
    while (message.length > 0) {
      const length = message.length;
      if (length < 6) {
        break;
      }
      const alleged_length = message[4] + (message[5] << 8);
      if (length >= alleged_length) {
        result.push(message.subarray(0, alleged_length));
        message = message.subarray(alleged_length, length);
      } else {
        break;
      }
    }
    return [result, message];
  }

  public async connect(refresh_status = true) {
    try {
      await this.promiseSocket.connect(this.port, this.ip);
      await this.promiseSocket.setTimeout(this.SOCKET_TIMEOUT);
      this.logger.debug(`Connecting to device ${this.name} (${this.ip}:${this.port})...`);
      if (this.version === ProtocolVersion.V3) {
        await this.authenticate();
      }
      let retries = 0;
      if (refresh_status) {
        let success = await this.refresh_status(true);
        while (!success && retries++ < 3) {
          success = await this.refresh_status(true, true);
        }
      }
      if (retries > 3) {
        this.logger.debug(`[${this.name}] Error when connecting to device ${this.name} (${this.ip}:${this.port}): Refresh status failed.`);
        return false;
      }
      // Start listening for network traffic
      this.open();
      return true;
    } catch (err) {
      this.logger.debug(`[${this.name}] Error when connecting to device ${this.name} (${this.ip}:${this.port}): ${err}`);
      return false;
    }
  }

  private async authenticate() {
    if (!(this.token && this.key)) {
      throw new Error('Token or key is missing!');
    }

    const request = this.security.encode_8370(this.token, TCPMessageType.HANDSHAKE_REQUEST);
    await this.promiseSocket.write(request);
    const response = await this.promiseSocket.read(512);

    if (response) {
      if (response.length < 20) {
        throw Error(`Authenticate error when receiving data from ${this.ip}:${this.port}. (Data length mismatch)`);
      }
      const resp = response.subarray(8, 72);
      this.security.tcp_key_from_resp(resp, this.key);
      this.logger.debug(`[${this.name}] Authentication success.`);
    } else {
      throw Error(`Authenticate error when receiving data from ${this.ip}:${this.port}.`);
    }
  }

  public async send_message(data: Buffer) {
    if (this.verbose) this.logger.debug(`[${this.name}] Send message:\n${data.toString('hex')}`);
    if (this.version === ProtocolVersion.V3) {
      await this.send_message_v3(data);
    } else {
      await this.send_message_v2(data);
    }
  }

  private async send_message_v2(data: Buffer, retries = 3, force_reinit = false) {
    if (retries === 0) {
      throw new Error(`[${this.name} | send_message] Error when sending data to device.`);
    }
    if (force_reinit || !this.promiseSocket || this.promiseSocket.destroyed) {
      this.promiseSocket = new PromiseSocket();
      let connected = await this.connect(false);
      while (!connected) {
        connected = await this.connect(false);
      }
    }
    try {
      await this.promiseSocket.write(data);
    } catch {
      this.logger.debug(`[${this.name}] Error when sending data to device, retrying...`);
      await this.send_message_v2(data, retries - 1, true);
    }
  }

  private async send_message_v3(data: Buffer, message_type: TCPMessageType = TCPMessageType.ENCRYPTED_REQUEST) {
    const encrypted_data = this.security.encode_8370(data, message_type);
    await this.send_message_v2(encrypted_data);
  }

  public async build_send(command: MessageRequest) {
    const data = command.serialize();
    const message = new PacketBuilder(this.id, data).finalize();
    await this.send_message(message);
  }

  public async refresh_status(wait_response = false, ignore_unsupported = false) {
    this.logger.debug(`[${this.name}] Refreshing status...`);
    const commands = this.build_query();
    if (this._sub_type === undefined) {
      commands.unshift(new MessageQuerySubtype(this.type));
    }
    let error_cnt = 0;
    for (const cmd of commands) {
      if (ignore_unsupported || !this.unsupported_protocol.includes(cmd.constructor.name)) {
        await this.build_send(cmd);
        if (wait_response) {
          try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
              const message = await this.promiseSocket.read(512);
              if (message.length === 0) {
                throw new Error(`[${this.name} | refresh_status] Error when receiving data from device.`);
              }
              const result = this.parse_message(message);
              if (result === ParseMessageResult.SUCCESS) {
                const cmd_idx = this.unsupported_protocol.indexOf(cmd.constructor.name);
                if (cmd_idx !== -1) {
                  this.unsupported_protocol.splice(cmd_idx, 1);
                }
                break;
              } else if (result === ParseMessageResult.PADDING) {
                continue;
              } else {
                throw new Error(`[${this.name} | refresh_status] Error when parsing message.`);
              }
            }
          } catch (err) {
            error_cnt++;
            // this.unsupported_protocol.push(cmd.constructor.name);
            this.logger.error(`[${this.name}] Does not supports the protocol ${cmd.constructor.name}, ignored, error: ${err}`);
          }
        }
      } else {
        error_cnt++;
      }
    }
    if (error_cnt === commands.length) {
      this.logger.error(`[${this.name}] Refresh failed.`);
      return false;
    }
    return true;
  }

  public preprocess_message(message: Buffer): boolean {
    if (message[9] === MessageType.QUERY_SUBTYPE) {
      const msg = new MessageSubtypeResponse(message);
      this._sub_type = msg.sub_type;
      this.set_subtype();
      this.device_protocol_version = msg.device_protocol_version;
      this.logger.debug(`[${this.name}] Subtype: ${this._sub_type}, device protocol version: ${this.device_protocol_version}`);
      return false;
    }
    return true;
  }

  public parse_message(message: Buffer) {
    let messages: Buffer[];
    if (this.verbose) this.logger.debug(`Raw data to parse:\n${message.toString('hex')}`);
    if (this.version === ProtocolVersion.V3) {
      [messages, this.buffer] = this.security.decode_8370(Buffer.concat([this.buffer, message]));
    } else {
      [messages, this.buffer] = this.fetch_v2_message(Buffer.concat([this.buffer, message]));
    }
    if (message.length === 0) {
      return ParseMessageResult.PADDING;
    }

    for (const msg of messages) {
      if (msg.toString('utf8') === 'ERROR') {
        return ParseMessageResult.ERROR;
      }
      const payload_length = msg[4] + (msg[5] << 8) - 56;
      const payload_type = msg[2] + (msg[3] << 8);
      if ([0x1001, 0x0001].includes(payload_type)) {
        // Heartbeat
        if (this.verbose) this.logger.debug(`Heartbeat:\n${msg.toString('hex')}`);
      } else if (msg.length > 56) {
        const cryptographic = msg.subarray(40, -16);
        if (payload_length % 16 === 0) {
          const decrypted = this.security.aes_decrypt(cryptographic);
          if (this.preprocess_message(decrypted)) {
            if (this.verbose) this.logger.debug(`Decrypted data to parse:\n${decrypted.toString('hex')}`);
            this.process_message(decrypted);
          }
        } else {
          this.logger.warn(`[${this.name}] Invalid payload length: ${payload_length}`);
        }
      } else {
        this.logger.warn(`[${this.name}] Illegal message.`);
      }
    }
    return ParseMessageResult.SUCCESS;
  }

  public async send_command(command_type: MessageType, command_body: Buffer) {
    const cmd = new MessageQuestCustom(this.type, command_type, command_body);
    try {
      if (this.verbose) this.logger.debug(`Send command: ${command_body.toString('hex')}`);
      await this.build_send(cmd);
    } catch (e) {
      this.logger.debug(`[${this.name}]  Interface send_command failure: ${e}, 
                        cmd_type: ${command_type}, 
                        cmd_body: ${command_body.toString('hex')}`);
    }
  }

  public async send_heartbeat() {
    const message = new PacketBuilder(this.id, Buffer.alloc(0)).finalize(0);
    await this.send_message(message);
  }

  // Register callback function to be called on any status change
  public register_update(update) {
    this.update_fns.push(update);
  }

  protected async update(values: DeviceAttributeBase) {
    this.logger.info(`[${this.name}] Status change: ${JSON.stringify(values)}`);
    for (const fn of this.update_fns) {
      fn(values);
    }
  }

  public open() {
    if (!this.is_running) {
      this.is_running = true;
      this.run();
    }
  }

  public close() {
    if (this.is_running) {
      this.is_running = false;
      this.close_socket();
    }
  }

  private close_socket() {
    this.unsupported_protocol = [];
    this.buffer = Buffer.alloc(0);
    if (this.promiseSocket) {
      this.promiseSocket.destroy();
    }
  }

  private async run() {
    this.logger.info(`Starting network listener for [${this.name}]`);
    while (this.is_running) {
      while (this.promiseSocket.destroyed) {
        this.logger.debug(`Create new socket, reconnect`);
        this.promiseSocket = new PromiseSocket();
        await this.connect(false);
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        await sleep(5000);
      }
      let timeout_counter = 0;
      const start = Date.now(); // milliseconds
      let previous_refresh = start;
      let previous_heartbeat = start;
      while (!this.promiseSocket.destroyed) {
        try {
          const now = Date.now();
          if (0 < this.refresh_interval && this.refresh_interval <= now - previous_refresh) {
            this.refresh_status();
            previous_refresh = now;
          } else if (now - previous_heartbeat >= this.heartbeat_interval) {
            this.send_heartbeat();
            previous_heartbeat = now;
          }
          this.promiseSocket.setTimeout(1000); // milliseconds
          const msg = await this.promiseSocket.read(512);
          if (msg.length > 0) {
            const result = this.parse_message(msg);
            if (result === ParseMessageResult.ERROR) {
              this.logger.debug(`[${this.name} | run] Error return from ParseMessageResult.`);
              break;
            } else if (result === ParseMessageResult.SUCCESS) {
              timeout_counter = 0;
            }
          } else {
            timeout_counter++;
          }
        }
        catch (e) {
          const msg = (e instanceof Error) ? e.stack : e;
          this.logger.error(`[${this.name} | run] Error reading from socket:\n${msg}`);
        }
      }
    }
    this.logger.info(`Stopping network listener for [${this.name}]`);
  }
}
