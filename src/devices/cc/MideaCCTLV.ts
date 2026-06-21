/***********************************************************************
 * TLV (Type-Length-Value) parsing and building utilities for the
 * MDV Wi-Fi Controller compact-range (FE branch) protocol.
 *
 * This module is protocol-agnostic: it operates on raw field indices and
 * byte buffers with no knowledge of field semantics. Protocol-specific
 * encoding lives in MideaCCMessage.ts.
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 */

// Multi-byte field sizes from T_0000_CC_10011006_2025033001.lua.
// All fields not listed here default to 1 byte.
function buildFieldSizes(): Map<number, number> {
  // biome-ignore format: easier to read as a flat list
  const m = new Map<number, number>([
    [  4, 2], // temperature_room      (uint16 BE, 0.1°C)
    [ 17, 5], // mode_supported        (multi-value, 5B)
    [ 34, 3], // cur_fault_code        (chars, 3B)
    [ 38, 2], // co2_value             (uint16)
    [ 47, 2], // selfclean_time_left   (uint16)
    [ 66, 4], // ptc_supported         (multi-value, 4B)
    [ 75, 4], // language_supported    (multi-value, 4B)
    [ 80, 6], // cur_fault_code        (chars, 6B)
    [ 82, 3], // about_version         (3B)
    [ 83, 3], // about_lua_version     (3B)
    [ 86, 4], // date_seconds          (uint32)
    [ 88, 2], // timer_on_timeout      (uint16)
    [ 90, 2], // timer_off_timeout     (uint16)
    // Schedule weekday (uint16) × 4 templates
    [ 95, 2], [132, 2], [169, 2], [206, 2],
    // Holiday year/date entries (uint16)
    [228, 2], [231, 2], [235, 2], [238, 2],
    [242, 2], [245, 2], [249, 2], [252, 2],
  ]);
  // mcs_idxN blocks: 19 entries each at base = 376 + N*19.
  //   base+1: fault_code (6B), base+3: temp_room (2B)
  for (let n = 0; n < 16; n++) {
    m.set(377 + n * 19, 6); // mcs_idxN_fault_code
    m.set(379 + n * 19, 2); // mcs_idxN_temp_room
  }
  return m;
}

export const FIELD_SIZES = buildFieldSizes();

/**
 * Parse a compact-range (FE branch) response body into a map of field index → raw bytes.
 *
 * Wire layout:
 *   [0]      protocol byte
 *   [1]      0xFE marker
 *   [2..3]   idx_start (big-endian)
 *   [4..5]   idx_end   (big-endian)
 *   [6..7]   total data length (big-endian, informational)
 *   [8..]    contiguous field data; each field consumes FIELD_SIZES[idx] ?? 1 bytes
 */
export function parseFEBranch(body: Buffer): Map<number, Buffer> {
  const result = new Map<number, Buffer>();
  if (body.length < 8) return result;
  const idxStart = (body[2] << 8) | body[3];
  const idxEnd   = (body[4] << 8) | body[5];
  let pos = 8;
  for (let idx = idxStart; idx <= idxEnd && pos < body.length; idx++) {
    const size = FIELD_SIZES.get(idx) ?? 1;
    if (pos + size > body.length) break;
    result.set(idx, body.subarray(pos, pos + size));
    pos += size;
  }
  return result;
}

/**
 * Build a single TLV control section: [idx_hi][idx_lo][len][bytes…][0xFF]
 */
export function tlvSection(idx: number, bytes: number[]): Buffer {
  return Buffer.from([idx >> 8, idx & 0xff, bytes.length, ...bytes, 0xff]);
}

// ---------------------------------------------------------------------------
// Bidirectional field descriptors
// ---------------------------------------------------------------------------

export type FieldMap = Map<number, Buffer>;

/** A field that can be decoded from a FE branch response. */
export interface FEReadField<T> {
  read(f: FieldMap): T | undefined;
}

/** A field that can be both decoded from a response and encoded into a control command. */
export interface FEField<T> extends FEReadField<T> {
  write(v: T): Buffer;
}

/**
 * Field whose read and write index are the same.
 * decode receives the single Buffer (already sized by FIELD_SIZES) or undefined.
 */
export function simpleField<T>(
  idx: number,
  decode: (buf: Buffer | undefined) => T | undefined,
  encode: (v: T) => number[],
): FEField<T> {
  return {
    read:  f => decode(f.get(idx)),
    write: v => tlvSection(idx, encode(v)),
  };
}

/**
 * Field with multiple read indices (e.g. an enable flag + a level byte) but a
 * single write index. decode receives one Buffer (or undefined) per read index.
 */
export function compositeField<T>(
  readIndices: readonly number[],
  writeIdx: number,
  decode: (bufs: Array<Buffer | undefined>) => T | undefined,
  encode: (v: T) => number[],
): FEField<T> {
  return {
    read:  f => decode(readIndices.map(i => f.get(i))),
    write: v => tlvSection(writeIdx, encode(v)),
  };
}

/** A response-only field with no corresponding control command. */
export function readOnlyField<T>(
  idx: number,
  decode: (buf: Buffer | undefined) => T | undefined,
): FEReadField<T> {
  return { read: f => decode(f.get(idx)) };
}

/** Convenience for the common pattern: single byte, 0x01=true / 0x00=false. */
export function boolField(idx: number): FEField<boolean> {
  return simpleField(
    idx,
    buf => buf?.[0] !== undefined ? buf[0] === 0x01 : undefined,
    v   => [v ? 1 : 0],
  );
}
