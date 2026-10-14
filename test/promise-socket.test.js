import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { DeviceType, ProtocolVersion } from '../src/core/MideaConstants.ts';
import { PromiseSocket } from '../src/core/MideaUtils.ts';
import MideaACDevice from '../src/devices/ac/MideaACDevice.ts';
import { defaultConfig, defaultDeviceConfig } from '../src/platformUtils.ts';

const logger = {
  debug() {},
  error() {},
  info() {},
  warn() {},
};

async function connectedPair(t) {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const accepted = once(server, 'connection');
  const socket = new PromiseSocket(logger, false);
  await socket.connect(server.address().port, '127.0.0.1');
  const [peer] = await accepted;
  t.after(() => {
    socket.destroy();
    peer.destroy();
    server.close();
  });
  return { socket, peer };
}

test('keeps data that arrives while no read is pending', async (t) => {
  const { socket, peer } = await connectedPair(t);

  peer.write('first');
  assert.equal((await socket.read()).toString(), 'first');

  // Nobody is reading while this arrives, e.g. a status push during a refresh.
  peer.write('pushed');
  await delay(50);

  assert.equal((await socket.read()).toString(), 'pushed');
});

test('resolves a pending read with an empty buffer on timeout', async (t) => {
  const { socket } = await connectedPair(t);
  socket.setTimeout(20);

  assert.deepEqual(await socket.read(), Buffer.alloc(0));
});

test('resolves a pending read with an empty buffer when destroyed', async (t) => {
  const { socket } = await connectedPair(t);

  const read = socket.read();
  socket.destroy();

  assert.deepEqual(await read, Buffer.alloc(0));
});

test('rejects a second concurrent read', async (t) => {
  const { socket, peer } = await connectedPair(t);

  const first = socket.read();
  await assert.rejects(socket.read(), /another read is pending/);

  peer.write('data');
  assert.equal((await first).toString(), 'data');
});

test('drops the reassembly buffer when a message fails to decode', () => {
  const device = new MideaACDevice(
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
  device.buffer = Buffer.from('partial frame');
  device.security.decode_8370 = () => {
    throw new Error('Sign does not match');
  };

  assert.throws(() => device.parse_message(Buffer.from('next frame')), /Sign does not match/);
  assert.deepEqual(device.buffer, Buffer.alloc(0));
});
