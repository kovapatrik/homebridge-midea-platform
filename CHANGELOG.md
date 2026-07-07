# Changelog

## [1.3.3](https://github.com/kovapatrik/homebridge-midea-platform/compare/v1.3.2...v1.3.3) (2026-07-07)


### Bug Fixes

* custom IP validation false negatives from stateful global regex ([#194](https://github.com/kovapatrik/homebridge-midea-platform/issues/194)) ([c748a1a](https://github.com/kovapatrik/homebridge-midea-platform/commit/c748a1af2afde204f8876851e05742a96ec7d7f3))

## [1.3.2](https://github.com/kovapatrik/homebridge-midea-platform/compare/v1.3.1...v1.3.2) (2026-07-03)


### Bug Fixes

* await refreshes, socket event handler, capabilities only once ([#189](https://github.com/kovapatrik/homebridge-midea-platform/issues/189)) ([c5b6857](https://github.com/kovapatrik/homebridge-midea-platform/commit/c5b68570e401649936e0acf8e3d1362f8e292037))

## [1.3.1](https://github.com/kovapatrik/homebridge-midea-platform/compare/v1.3.0...v1.3.1) (2026-07-02)


### Bug Fixes

* lodash dep ([c0061f6](https://github.com/kovapatrik/homebridge-midea-platform/commit/c0061f62b493430866860eeb0c6533e5b1922e8d))
* type safe custom UI, linter/formatter changed to oxc ([#184](https://github.com/kovapatrik/homebridge-midea-platform/issues/184)) ([6463180](https://github.com/kovapatrik/homebridge-midea-platform/commit/6463180927a93a98bd02215cc6466aeda4f014ab))
* update all accessory states on setting a state, contributing ([#186](https://github.com/kovapatrik/homebridge-midea-platform/issues/186)) ([8b85b63](https://github.com/kovapatrik/homebridge-midea-platform/commit/8b85b635085955501dc79f7d92a7ae5e6ea634d1))

## [1.3.0](https://github.com/kovapatrik/homebridge-midea-platform/compare/v1.2.10...v1.3.0) (2026-06-30)

### Features

- **AC:** Add option to expose humidity sensor ([#171](https://github.com/kovapatrik/homebridge-midea-platform/issues/171)) ([c928e43](https://github.com/kovapatrik/homebridge-midea-platform/commit/c928e435961331518ac6701ca97189209c6664c5))
- protocol reworks ([#178](https://github.com/kovapatrik/homebridge-midea-platform/issues/178)) ([c231ba4](https://github.com/kovapatrik/homebridge-midea-platform/commit/c231ba41282e132b93ea6b8052d20622cf928692))
- use release please ([1cb1c16](https://github.com/kovapatrik/homebridge-midea-platform/commit/1cb1c167baa8f92767897968f7873133a8a71a59))
- **AC**: added support for Out Silent Mode and ION (anion) (fixes Add deeper support for Midea Portasplit #105, AC Ioniser (Anion) Control and State Issues #146, Medea Portasplit Silent Mode #172)
- **A1**: fixed pump setting (fixes Pump Switch not working properly #136)
- **AC, A1 and CC**: feature parity with midea-local

### Bug Fixes

- gate reconnect lifecycle logs behind logRecoverableErrors ([#170](https://github.com/kovapatrik/homebridge-midea-platform/issues/170)) ([efc1217](https://github.com/kovapatrik/homebridge-midea-platform/commit/efc12178695258843b68d3ab849f94bd579aa5ed))
- use workflow call to publish [skip ci] ([8281273](https://github.com/kovapatrik/homebridge-midea-platform/commit/828127308ba5a381b759405f045e9915326893dd))

## v1.2.10

- fix: added logic to persist fan speed when toggling fan related modes (like sleep mode, boost mode, etc...) in `Air Conditioner` (fixes #158)
- feat: added separate switch for setting `Air Conditioner` fan auto mode (fixes #152)
- feat: added basic/partial support for 0xCC `MDV WiFi Controller` (fixes #126)
- fix: water tank sensors are cleaned up for `Dehumidifier` (fixes #160)
- fix: authentication and connection logic fixes (by @Ben-Diehlci)
- feat: added option to set Thermostat as the service type for AC devices (by @Ben-Diehlci)

## v1.2.9

- feat: added separate temperature sensor creation option for `Air Conditioner` (fixes #141)

## v1.2.8

- fix: boost/comfort/eco mode was not working for `Air Conditioner` (fixes #154)

## v1.2.7

- feat: emulate HomeKit heat and cool thresholds for `Air Conditioner` (fixes #134)
  - this allows to use HomeKit's `Auto` mode for `Air Conditioner` devices in a way Midea using it
- fix: removed not needed screen display setter for `Air Conditioner` devices

## v1.2.6

- feat: added partial support for `Fresh Air Appliance` (issue #118)
- feat: added sleep mode switch for `Air Conditioner` (fixes #128)
- feat: added comfort mode switch for `Air Conditioner` (fixes #132)
- feat: added support for `Heat Pump Water Heater` (fixes #125)
- fix: store and display name of sub-service if it's changed from the Home app (fixed #120)
  - you might have duplicated accessories because of this, please delete the cached accessories for this plugin to remove them
  - you can do this from the Homebridge UI: three dots in the top right side -> Settings -> scroll down to the bottom and there will be a `Remove Single Accessory` button -> use that and remove everything which is connected to the plugin `homebridge-midea-platform`

## v1.2.5

- fix: getting tokens/key for devices
  - IMPORTANT CHANGE: please read the [README](README.md#important-notice) about the change fetching the tokens

## v1.2.4

- feat: added support for `Humidifiers` (fixes #114)
- fix: mark accessories as 'Not responding' if the device is presumed offline
- chore: changed linter and formatter to biome.js and applied all the necessary changes

## v1.2.3

- fix: checking if cloud provider can be used for downloading Lua files in the discovery process

## v1.2.2

- version bump to fix the npm package

## v1.2.1

### 2024-10-26

- BREAKING CHANGE: the plugin is now following Homebridge 2.0.0 compatible. This caused a lot of eslint and import clause rewrites.
- BREAKING CHANGE: Node version support is now `^18.20.4 || ^20.18.0 || ^22.10.0`.
- feat: added support for `Front Load Washers` (fixes #87)
- feat: added support for `Dishwashers` (fixes #104)
- feat: added possibility to add custom humidity offset for `Dehumidifiers` (fixes #98)
- feat: added possibility to toggle boost/turbo mode switch creation for `Air Conditioners` (fixes #102)
- feat: possibilty to download Lua files using the config UI (fixes #69)
- feat: `logRefreshStatusErrors` flag per device is added for hiding errors in the logs (fixes #93)
- feat: partial support for `Heat Pump WiFi Controller`
- fix: explicitly set the power when changing the mode for `Air Conditioners` (fixes #99)
- fix: handling of sending out messages to devices, excluding existing state commands (fixes #99, #101)
- fix: QoL improvements and bug fixes (TCP key error, etc.)
- chore: deleted unnecessary flags

## v1.1.0

### 2024-07-13

- BREAKING CHANGE: `Air Conditioner` configuration changed: there is now a possibility to create an accessory which can be used to control the slats on the unit. THe configuration structure has changed. Please check [AC docs](/docs/ac.md) for more information (or just save the configuration again in the plugin settings to get the new structure).
- feat: added support for `Fans` (fixes #74)
- feat: added feature to turn off the display by default on power on for `Air Conditioners`
- feat: ability to change the temperature display unit from the Home app for `Air Conditioners`
- fix: default temperature unit display for `Air Conditioners` (previously the `fahrenheit` setting didn't work)
- fix: added option to add a seperate humidity sensor to `Dehumidifiers` (fixes #88)
- fix: added option to add a fan accessory to `Dehumidifiers` (fixes #89)
- fix: wait for device response before adding it to Homebridge

## v1.0.6

### 2024-06-15

- BREAKING CHANGE: there is a new conifguration option `fanOnlyModeSwitch` which will only turn on fan only mode. There is a possiblity to create an accessory to manage fan only mode using option `fanAccessory`. Setting fan to auto mode can be done from the fan accessory
- fix: NetHome Plus login
- minor quality of life improvements
