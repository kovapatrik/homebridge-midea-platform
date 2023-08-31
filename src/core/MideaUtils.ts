import { Endianness } from './MideaConstants';

export function concatUint8Arrays(a: Uint8Array, b: Uint8Array) {
  const c = new Uint8Array(a.length + b.length);
  c.set(a);
  c.set(b, a.length);
  return c;
}

export function numberToUint8Array(num: number, byte_length: number, endianness: Endianness) {
  const arr = new Uint8Array(byte_length);
  for (let i = 0; i < byte_length; i++) {
    arr[i] = num % 256;
    num = Math.floor(num / 256);
  }
  if (endianness === 'big') {
    arr.reverse();
  }
  return arr;
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