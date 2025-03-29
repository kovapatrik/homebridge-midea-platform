/***********************************************************************
 * Homebridge-midea-platform miscellaneous support functions.
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Portions Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * Includes very basic implementation of a promise-wrapped Socket class.
 *
 */
import { Socket } from 'node:net';
import type { Logger } from 'homebridge';
import { Endianness } from './MideaConstants.js';

export function numberToUint8Array(inputNum: number, byte_length: number, endianness: Endianness) {
  const arr = new Uint8Array(byte_length);
  let num = inputNum;
  for (let i = 0; i < byte_length; i++) {
    arr[i] = num % 256;
    num = Math.floor(num / 256);
  }
  return endianness === Endianness.Big ? arr.reverse() : arr;
}

export function strxor(a: Buffer, b: Buffer) {
  if (a.length !== b.length) {
    throw Error('strxor: a and b must have the same length!');
  }

  const output = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) {
    output[i] = a[i] ^ b[i];
  }

  return output;
}

const CRC8_854_TABLE = [
  0x00, 0x5e, 0xbc, 0xe2, 0x61, 0x3f, 0xdd, 0x83, 0xc2, 0x9c, 0x7e, 0x20, 0xa3, 0xfd, 0x1f, 0x41, 0x9d, 0xc3, 0x21, 0x7f, 0xfc, 0xa2, 0x40, 0x1e, 0x5f, 0x01,
  0xe3, 0xbd, 0x3e, 0x60, 0x82, 0xdc, 0x23, 0x7d, 0x9f, 0xc1, 0x42, 0x1c, 0xfe, 0xa0, 0xe1, 0xbf, 0x5d, 0x03, 0x80, 0xde, 0x3c, 0x62, 0xbe, 0xe0, 0x02, 0x5c,
  0xdf, 0x81, 0x63, 0x3d, 0x7c, 0x22, 0xc0, 0x9e, 0x1d, 0x43, 0xa1, 0xff, 0x46, 0x18, 0xfa, 0xa4, 0x27, 0x79, 0x9b, 0xc5, 0x84, 0xda, 0x38, 0x66, 0xe5, 0xbb,
  0x59, 0x07, 0xdb, 0x85, 0x67, 0x39, 0xba, 0xe4, 0x06, 0x58, 0x19, 0x47, 0xa5, 0xfb, 0x78, 0x26, 0xc4, 0x9a, 0x65, 0x3b, 0xd9, 0x87, 0x04, 0x5a, 0xb8, 0xe6,
  0xa7, 0xf9, 0x1b, 0x45, 0xc6, 0x98, 0x7a, 0x24, 0xf8, 0xa6, 0x44, 0x1a, 0x99, 0xc7, 0x25, 0x7b, 0x3a, 0x64, 0x86, 0xd8, 0x5b, 0x05, 0xe7, 0xb9, 0x8c, 0xd2,
  0x30, 0x6e, 0xed, 0xb3, 0x51, 0x0f, 0x4e, 0x10, 0xf2, 0xac, 0x2f, 0x71, 0x93, 0xcd, 0x11, 0x4f, 0xad, 0xf3, 0x70, 0x2e, 0xcc, 0x92, 0xd3, 0x8d, 0x6f, 0x31,
  0xb2, 0xec, 0x0e, 0x50, 0xaf, 0xf1, 0x13, 0x4d, 0xce, 0x90, 0x72, 0x2c, 0x6d, 0x33, 0xd1, 0x8f, 0x0c, 0x52, 0xb0, 0xee, 0x32, 0x6c, 0x8e, 0xd0, 0x53, 0x0d,
  0xef, 0xb1, 0xf0, 0xae, 0x4c, 0x12, 0x91, 0xcf, 0x2d, 0x73, 0xca, 0x94, 0x76, 0x28, 0xab, 0xf5, 0x17, 0x49, 0x08, 0x56, 0xb4, 0xea, 0x69, 0x37, 0xd5, 0x8b,
  0x57, 0x09, 0xeb, 0xb5, 0x36, 0x68, 0x8a, 0xd4, 0x95, 0xcb, 0x29, 0x77, 0xf4, 0xaa, 0x48, 0x16, 0xe9, 0xb7, 0x55, 0x0b, 0x88, 0xd6, 0x34, 0x6a, 0x2b, 0x75,
  0x97, 0xc9, 0x4a, 0x14, 0xf6, 0xa8, 0x74, 0x2a, 0xc8, 0x96, 0x15, 0x4b, 0xa9, 0xf7, 0xb6, 0xe8, 0x0a, 0x54, 0xd7, 0x89, 0x6b, 0x35,
];

export function calculate(data: Buffer) {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    let k = crc ^ data[i];
    if (k > 256) {
      k -= 256;
    }
    if (k < 0) {
      k += 256;
    }
    crc = CRC8_854_TABLE[k];
  }
  return crc;
}

/*********************************************************************
 * PromiseSocket
 * A very basic implementation of promise-wrapped Socket
 *
 */
export class PromiseSocket {
  private innerSok: Socket;
  public destroyed: boolean;

  constructor(
    private readonly logger: Logger,
    private readonly logerror: boolean,
  ) {
    this.innerSok = new Socket();
    this.destroyed = false;
    this.innerSok.on('error', (e) => {
      // Log the error
      const msg = e instanceof Error ? e.stack : e;
      if (this.logerror) {
        this.logger.warn(`Socket error:\n${msg}`);
      } else {
        this.logger.debug(`Socket error:\n${msg}`);
      }
      // According to https://nodejs.org/api/net.html#event-error_1 the "close" event
      // will be called immediately following an "error" event.  So don't throw an error
      // and handle the destory in the close event.
    });
    this.innerSok.on('close', async (hadError: boolean) => {
      this.destroy();
      if (this.logerror) {
        this.logger.warn(`Socket closed ${hadError ? 'with' : 'without'} error`);
      } else {
        this.logger.debug(`Socket closed ${hadError ? 'with' : 'without'} error`);
      }
    });
  }

  public async connect(port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const errorHandler = (err: Error) => {
        removeListeners();
        reject(err);
      };
      const removeListeners = () => {
        this.innerSok.removeListener('error', errorHandler);
      };

      this.innerSok.connect(port, host, () => {
        // This function is added as a "connect" listener so called
        // on successful connection.
        removeListeners();
        resolve();
      });

      this.innerSok.on('error', errorHandler);
    });
  }

  public setTimeout(t: number) {
    this.innerSok.setTimeout(t);
  }

  public destroy() {
    this.destroyed = true;
    this.innerSok.destroy();
  }

  public async write(data: string | Buffer, encoding?: BufferEncoding) {
    return new Promise<void>((resolve, reject) => {
      const errorHandler = (err: Error) => {
        removeListeners();
        reject(err);
      };
      const removeListeners = () => {
        this.innerSok.removeListener('error', errorHandler);
      };

      this.innerSok.on('error', errorHandler);

      try {
        this.innerSok.write(data, encoding, (err) => {
          // This function is called when all data successfully sent
          removeListeners();
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (err) {
        removeListeners();
        reject(err);
      }
    });
  }

  public async read() {
    return new Promise<Buffer>((resolve, reject) => {
      let buf = Buffer.alloc(0);

      const dataHandler = (data: Buffer) => {
        buf = Buffer.concat([buf, data]);
        removeListeners();
        resolve(buf);
      };
      const timeoutHandler = () => {
        removeListeners();
        resolve(buf);
      };
      const endHandler = () => {
        removeListeners();
        resolve(buf);
      };
      const errorHandler = (err: Error) => {
        removeListeners();
        reject(err);
      };
      const closeHandler = () => {
        removeListeners();
        resolve(buf);
      };
      const removeListeners = () => {
        this.innerSok.removeListener('close', closeHandler);
        this.innerSok.removeListener('data', dataHandler);
        this.innerSok.removeListener('timeout', timeoutHandler);
        this.innerSok.removeListener('end', endHandler);
        this.innerSok.removeListener('error', errorHandler);
      };

      this.innerSok.on('close', closeHandler);
      this.innerSok.on('data', dataHandler);
      this.innerSok.on('timeout', timeoutHandler);
      this.innerSok.on('end', endHandler);
      this.innerSok.on('error', errorHandler);
    });
  }
}
