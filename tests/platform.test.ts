import { readFileSync, writeFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CloudFactory from '../src/core/MideaCloud.js';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('node:net', () => ({
  createConnection: vi.fn(),
}));

vi.mock('../src/core/MideaCloud.js', () => ({
  default: {
    createCloud: vi.fn(),
  },
}));

vi.mock('../src/core/MideaDiscover.js', () => ({
  default: class MockDiscover {
    on = vi.fn();
    startDiscover = vi.fn();
    discoverDeviceByIP = vi.fn();
  },
}));

vi.mock('../src/accessory/AccessoryFactory.js', () => ({
  default: {
    createAccessory: vi.fn(),
  },
}));

vi.mock('../src/devices/DeviceFactory.js', () => ({
  default: {
    createDevice: vi.fn(),
  },
}));

vi.mock('lodash', () => ({
  default: {
    defaultsDeep: vi.fn((obj: Record<string, unknown>, def: Record<string, unknown>) => {
      for (const key of Object.keys(def)) {
        if (obj[key] === undefined || obj[key] === null) {
          obj[key] = def[key];
        } else if (typeof obj[key] === 'object' && typeof def[key] === 'object') {
          Object.assign(obj[key] as Record<string, unknown>, def[key] as Record<string, unknown>);
        }
      }
      return obj;
    }),
  },
}));

// Import after mocks
import { MideaPlatform } from '../src/platform.js';

const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockApi = {
  hap: {
    uuid: { generate: vi.fn((s: string) => `uuid-${s}`) },
    Service: vi.fn(),
    Characteristic: vi.fn(),
  },
  user: { configPath: vi.fn(() => '/fake/config.json') },
  updatePlatformAccessories: vi.fn(),
  registerPlatformAccessories: vi.fn(),
  on: vi.fn(),
  platformAccessory: vi.fn(),
};

function createPlatform(config = {}) {
  return new MideaPlatform(
    mockLog as unknown as import('homebridge').Logger,
    { platform: 'midea-platform', devices: [], ...config } as import('homebridge').PlatformConfig,
    mockApi as unknown as import('homebridge').API,
  );
}

describe('MideaPlatform token refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when account and password are missing', async () => {
    const platform = createPlatform();
    await (platform as unknown as Record<string, () => Promise<void>>).refreshTokens();
    expect(CloudFactory.createCloud).not.toHaveBeenCalled();
  });

  it('does nothing when only account is provided', async () => {
    const platform = createPlatform({ account: 'user@test.com' });
    await (platform as unknown as Record<string, () => Promise<void>>).refreshTokens();
    expect(CloudFactory.createCloud).not.toHaveBeenCalled();
  });

  it('fetches tokens and updates config when they have rotated (forceRefresh)', async () => {
    const mockCloud = {
      login: vi.fn().mockResolvedValue(undefined),
      getTokenKey: vi.fn().mockResolvedValue([Buffer.from('616263', 'hex'), Buffer.from('646566', 'hex')]),
    };
    (CloudFactory.createCloud as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockCloud);

    const platform = createPlatform({
      account: 'user@test.com',
      password: 'secret',
      devices: [
        {
          id: 123456789,
          name: 'Test AC',
          type: 'Air Conditioner',
          advanced_options: { token: '010203', key: '040506', ip: '192.168.1.50' },
        },
      ],
    });

    // Mock validateToken to return true
    vi.spyOn(platform as unknown as { validateToken: () => Promise<boolean> }, 'validateToken').mockResolvedValue(true);

    (readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify({ platforms: [{ platform: 'midea-platform', devices: [] }] }));

    await (platform as unknown as Record<string, () => Promise<void>>).refreshTokens(true);

    expect(mockCloud.login).toHaveBeenCalledOnce();
    expect(mockCloud.getTokenKey).toHaveBeenCalledWith(123456789, 0);
    expect(writeFileSync).toHaveBeenCalledOnce();
    const writeCall = (writeFileSync as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(writeCall[0]).toBe('/fake/config.json');
    expect(writeCall[1]).toContain('616263');
    expect(writeCall[1]).toContain('646566');
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('Token validated'));
  });

  it('does not overwrite existing tokens at startup (conservative)', async () => {
    const mockCloud = {
      login: vi.fn().mockResolvedValue(undefined),
      getTokenKey: vi.fn().mockResolvedValue([Buffer.from('616263', 'hex'), Buffer.from('646566', 'hex')]),
    };
    (CloudFactory.createCloud as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockCloud);

    const platform = createPlatform({
      account: 'user@test.com',
      password: 'secret',
      devices: [
        {
          id: 123456789,
          name: 'Test AC',
          type: 'Air Conditioner',
          advanced_options: { token: '010203', key: '040506', ip: '192.168.1.50' },
        },
      ],
    });

    await (platform as unknown as Record<string, () => Promise<void>>).refreshTokens(false);

    expect(mockCloud.getTokenKey).toHaveBeenCalledOnce();
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping update at startup'));
  });

  it('does not persist config when tokens are unchanged', async () => {
    const mockCloud = {
      login: vi.fn().mockResolvedValue(undefined),
      getTokenKey: vi.fn().mockResolvedValue([Buffer.from('010203', 'hex'), Buffer.from('040506', 'hex')]),
    };
    (CloudFactory.createCloud as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockCloud);

    const platform = createPlatform({
      account: 'user@test.com',
      password: 'secret',
      devices: [
        {
          id: 123456789,
          name: 'Test AC',
          type: 'Air Conditioner',
          advanced_options: { token: '010203', key: '040506' },
        },
      ],
    });

    await (platform as unknown as Record<string, () => Promise<void>>).refreshTokens();

    expect(mockCloud.getTokenKey).toHaveBeenCalledOnce();
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('does not save when cloud token fails local validation (forceRefresh)', async () => {
    const mockCloud = {
      login: vi.fn().mockResolvedValue(undefined),
      getTokenKey: vi.fn().mockResolvedValue([Buffer.from('badbad', 'hex'), Buffer.from('badbad', 'hex')]),
    };
    (CloudFactory.createCloud as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockCloud);

    const platform = createPlatform({
      account: 'user@test.com',
      password: 'secret',
      devices: [
        {
          id: 123456789,
          name: 'Test AC',
          type: 'Air Conditioner',
          advanced_options: { token: '010203', key: '040506', ip: '192.168.1.50' },
        },
      ],
    });

    vi.spyOn(platform as unknown as { validateToken: () => Promise<boolean> }, 'validateToken').mockResolvedValue(false);

    await (platform as unknown as Record<string, () => Promise<void>>).refreshTokens(true);

    expect(mockCloud.getTokenKey).toHaveBeenCalledOnce();
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('failed local validation'));
  });

  it('fills missing token at startup if cloud token validates', async () => {
    const mockCloud = {
      login: vi.fn().mockResolvedValue(undefined),
      getTokenKey: vi.fn().mockResolvedValue([Buffer.from('616263', 'hex'), Buffer.from('646566', 'hex')]),
    };
    (CloudFactory.createCloud as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockCloud);

    const platform = createPlatform({
      account: 'user@test.com',
      password: 'secret',
      devices: [
        {
          id: 123456789,
          name: 'Test AC',
          type: 'Air Conditioner',
          advanced_options: { token: '', key: '', ip: '192.168.1.50' },
        },
      ],
    });

    vi.spyOn(platform as unknown as { validateToken: () => Promise<boolean> }, 'validateToken').mockResolvedValue(true);

    (readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify({ platforms: [{ platform: 'midea-platform', devices: [] }] }));

    await (platform as unknown as Record<string, () => Promise<void>>).refreshTokens(false);

    expect(writeFileSync).toHaveBeenCalledOnce();
    const writeCall = (writeFileSync as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(writeCall[1]).toContain('616263');
  });

  it('deduplicates concurrent refresh calls', async () => {
    let resolveLogin: (() => void) | undefined;
    const mockCloud = {
      login: vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveLogin = resolve;
          }),
      ),
      getTokenKey: vi.fn().mockResolvedValue([Buffer.from('010203', 'hex'), Buffer.from('040506', 'hex')]),
    };
    (CloudFactory.createCloud as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockCloud);

    const platform = createPlatform({
      account: 'user@test.com',
      password: 'secret',
      devices: [
        {
          id: 123456789,
          name: 'Test AC',
          type: 'Air Conditioner',
          advanced_options: { token: '010203', key: '040506' },
        },
      ],
    });

    const p1 = (platform as unknown as Record<string, () => Promise<void>>).refreshTokens();
    const p2 = (platform as unknown as Record<string, () => Promise<void>>).refreshTokens();

    // Should only have called login once so far
    expect(mockCloud.login).toHaveBeenCalledTimes(1);

    resolveLogin?.();
    await Promise.all([p1, p2]);

    // After resolving, still only one login
    expect(mockCloud.login).toHaveBeenCalledTimes(1);
  });

  it('logs a warning when cloud login fails', async () => {
    const mockCloud = {
      login: vi.fn().mockRejectedValue(new Error('bad credentials')),
    };
    (CloudFactory.createCloud as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockCloud);

    const platform = createPlatform({
      account: 'user@test.com',
      password: 'secret',
      devices: [{ id: 1, name: 'AC', type: 'Air Conditioner', advanced_options: {} }],
    });

    await (platform as unknown as Record<string, () => Promise<void>>).refreshTokens();

    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('bad credentials'));
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('updates accessory cache when tokens rotate', async () => {
    const mockCloud = {
      login: vi.fn().mockResolvedValue(undefined),
      getTokenKey: vi.fn().mockResolvedValue([Buffer.from('aabbcc', 'hex'), Buffer.from('ddeeff', 'hex')]),
    };
    (CloudFactory.createCloud as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockCloud);

    const platform = createPlatform({
      account: 'user@test.com',
      password: 'secret',
      devices: [
        {
          id: 999,
          name: 'Bedroom AC',
          type: 'Air Conditioner',
          advanced_options: { token: '000000', key: '000000', ip: '192.168.1.50' },
        },
      ],
    });

    (readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify({ platforms: [{ platform: 'midea-platform', devices: [] }] }));

    // Seed the accessory cache
    const fakeAccessory = {
      UUID: 'uuid-999',
      displayName: 'Bedroom AC',
      context: { token: '000000', key: '000000' },
    };
    (platform as unknown as { accessories: Map<string, unknown> }).accessories.set(
      'uuid-999',
      fakeAccessory as unknown as import('homebridge').PlatformAccessory,
    );

    vi.spyOn(platform as unknown as { validateToken: () => Promise<boolean> }, 'validateToken').mockResolvedValue(true);

    await (platform as unknown as Record<string, () => Promise<void>>).refreshTokens(true);

    expect(fakeAccessory.context.token).toBe('aabbcc');
    expect(fakeAccessory.context.key).toBe('ddeeff');
    expect(mockApi.updatePlatformAccessories).toHaveBeenCalledWith([fakeAccessory]);
  });

  describe('saveConfig', () => {
    it('writes updated config to config.json', () => {
      const platform = createPlatform({
        devices: [{ id: 1, name: 'A', type: 'Air Conditioner', advanced_options: { token: 't1', key: 'k1' } }],
      });

      (readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({
          platforms: [
            { platform: 'midea-platform', name: 'Midea', devices: [{ id: 1, name: 'Old' }] },
            { platform: 'other', devices: [] },
          ],
        }),
      );

      (platform as unknown as Record<string, () => void>).saveConfig();

      expect(readFileSync).toHaveBeenCalledWith('/fake/config.json', 'utf-8');
      const writeArgs = (writeFileSync as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      const saved = JSON.parse(writeArgs[1] as string);
      expect(saved.platforms[0].devices[0].advanced_options.token).toBe('t1');
      expect(saved.platforms[1].devices).toEqual([]);
    });

    it('logs an error when persisting config fails', () => {
      const platform = createPlatform();
      (readFileSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('disk full');
      });

      (platform as unknown as Record<string, () => void>).saveConfig();

      expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    });
  });
});
