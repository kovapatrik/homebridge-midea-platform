import assert from 'node:assert/strict';
import test from 'node:test';
import { DeviceType, ProtocolVersion } from '../src/core/MideaConstants.ts';
import MideaACDevice from '../src/devices/ac/MideaACDevice.ts';
import {
  MessageCapabilitiesAdditionalQuery,
  MessageCapabilitiesQuery,
  MessageGroupZeroQuery,
  MessageHumidityQuery,
  MessageNewProtocolQuery,
  MessagePowerQuery,
  MessageQuery,
} from '../src/devices/ac/MideaACMessage.ts';
import { defaultConfig, defaultDeviceConfig } from '../src/platformUtils.ts';

const SCREEN_DISPLAY_TAG = 0x0017;
const ERROR_CODE_QUERY_TAG = 0x003f;

const logger = {
  debug() {},
  error() {},
  info() {},
  warn() {},
};

function createDevice() {
  return new MideaACDevice(
    logger,
    {
      ip: '127.0.0.1',
      port: 6444,
      id: 1,
      model: 'test',
      sn: 'test',
      name: 'Test AC',
      type: DeviceType.AIR_CONDITIONER,
      version: ProtocolVersion.V3,
    },
    structuredClone(defaultConfig),
    structuredClone(defaultDeviceConfig),
  );
}

function getNewProtocolQueryTags(device) {
  const query = device.build_query().find((message) => message instanceof MessageNewProtocolQuery);
  assert.ok(query);

  const body = query._body;
  const count = body[0];
  assert.equal(body.length, 1 + count * 2);

  return Array.from({ length: count }, (_, index) => body.readUInt16LE(1 + index * 2));
}

test('preserves periodic queries and only requests capabilities once', () => {
  const device = createDevice();
  const queries = device.build_query();

  assert.equal(queries.length, 7);
  assert.ok(queries[0] instanceof MessageQuery);
  assert.ok(queries[1] instanceof MessageNewProtocolQuery);
  assert.ok(queries[2] instanceof MessagePowerQuery);
  assert.ok(queries[3] instanceof MessageHumidityQuery);
  assert.ok(queries[4] instanceof MessageGroupZeroQuery);
  assert.ok(queries[5] instanceof MessageCapabilitiesQuery);
  assert.ok(queries[6] instanceof MessageCapabilitiesAdditionalQuery);

  assert.equal(device.build_query().length, 5);
});

test('omits display-waking tags from the periodic extended query', () => {
  const device = createDevice();
  const tags = getNewProtocolQueryTags(device);
  assert.equal(tags.includes(SCREEN_DISPLAY_TAG), false);
  assert.equal(tags.includes(ERROR_CODE_QUERY_TAG), false);

  device.set_alternate_switch_display(true);
  const alternateDisplayTags = getNewProtocolQueryTags(device);
  assert.equal(alternateDisplayTags.includes(SCREEN_DISPLAY_TAG), true);
  assert.equal(alternateDisplayTags.includes(ERROR_CODE_QUERY_TAG), false);
});
