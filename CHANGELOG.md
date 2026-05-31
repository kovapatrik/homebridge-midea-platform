# Changelog

# v1.2.10
- fix: added logic to persist fan speed when toggling fan related modes (like sleep mode, boost mode, etc...) in `Air Conditioner` (fixes #158)
- feat: added separate switch for setting `Air Conditioner` fan auto mode (fixes #152)
- feat: added basic/partial support for 0xCC `MDV WiFi Controller` (fixes #126)
- fix: water tank sensors are cleaned up for `Dehumidifier` (fixes #160)
- fix: authentication and connection logic fixes (by @Ben-Diehlci)
- feat: added option to set Thermostat as the service type for AC devices (by @Ben-Diehlci)

# v1.2.9
- feat: added separate temperature sensor creation option for `Air Conditioner` (fixes #141)

# v1.2.8
- fix: boost/comfort/eco mode was not working for `Air Conditioner` (fixes #154)

# v1.2.7
- feat: emulate HomeKit heat and cool thresholds for `Air Conditioner` (fixes #134)
  - this allows to use HomeKit's `Auto` mode for `Air Conditioner` devices in a way Midea using it
- fix: removed not needed screen display setter for `Air Conditioner` devices

# v1.2.6
- feat: added partial support for `Fresh Air Appliance` (issue #118)
- feat: added sleep mode switch for `Air Conditioner` (fixes #128)
- feat: added comfort mode switch for `Air Conditioner` (fixes #132)
- feat: added support for `Heat Pump Water Heater` (fixes #125)
- fix: store and display name of sub-service if it's changed from the Home app (fixed #120)
  - you might have duplicated accessories because of this, please delete the cached accessories for this plugin to remove them
  - you can do this from the Homebridge UI: three dots in the top right side -> Settings -> scroll down to the bottom and there will be a `Remove Single Accessory` button -> use that and remove everything which is connected to the plugin `homebridge-midea-platform`

# v1.2.5
- fix: getting tokens/key for devices
  - IMPORTANT CHANGE: please read the [README](README.md#important-notice) about the change fetching the tokens

# v1.2.4
- feat: added support for `Humidifiers` (fixes #114)
- fix: mark accessories as 'Not responding' if the device is presumed offline
- chore: changed linter and formatter to biome.js and applied all the necessary changes

# v1.2.3
- fix: checking if cloud provider can be used for downloading Lua files in the discovery process

# v1.2.2
- version bump to fix the npm package

# v1.2.1
## [1.3.0](https://github.com/kovapatrik/homebridge-midea-platform/compare/homebridge-midea-platform-v1.2.10...homebridge-midea-platform-v1.3.0) (2026-05-31)


### Features

* auth working ([779bfa2](https://github.com/kovapatrik/homebridge-midea-platform/commit/779bfa260f24941b902d3b793aead0cf13923101))
* cloud apps, switch display ([52ee19f](https://github.com/kovapatrik/homebridge-midea-platform/commit/52ee19fc96257e97f7668d86d347c0bf04cd641d))
* configUI ([#3](https://github.com/kovapatrik/homebridge-midea-platform/issues/3)) ([3a0879b](https://github.com/kovapatrik/homebridge-midea-platform/commit/3a0879b7f31ab52dbdc5147c97a3ce1755d1dd71))
* Fan implemented, new features for Air Conditioner, fan accessory for (De)humidifers ([#92](https://github.com/kovapatrik/homebridge-midea-platform/issues/92)) ([9cf3eec](https://github.com/kovapatrik/homebridge-midea-platform/commit/9cf3eeca82e9ca798fb2cf1660e8477932c4cec7))
* group/ungroup accessories ([4235003](https://github.com/kovapatrik/homebridge-midea-platform/commit/423500363a13744536b5516465030d0fe67f0e4f))
* more apps supported ([54ff722](https://github.com/kovapatrik/homebridge-midea-platform/commit/54ff722b8c03bf2322f6da872b1b901ff2013e9f))
* screen display switch based on config ([97cfd3f](https://github.com/kovapatrik/homebridge-midea-platform/commit/97cfd3f8c9367474fa91e16c940bae59c3583530))
* TCP connection done, needs to define message types ([b963e8c](https://github.com/kovapatrik/homebridge-midea-platform/commit/b963e8cff8d9dfd610976bc5bb1bb51e2778f0ea))
* use release please ([1cb1c16](https://github.com/kovapatrik/homebridge-midea-platform/commit/1cb1c167baa8f92767897968f7873133a8a71a59))


### Bug Fixes

* async credential fetch ([33532b0](https://github.com/kovapatrik/homebridge-midea-platform/commit/33532b0eb6e8c04adde400cccba9071d5816271d))
* better error logging ([7a36110](https://github.com/kovapatrik/homebridge-midea-platform/commit/7a361101f36eb04b52518a653db3138faafe360d))
* caching solved ([d89915d](https://github.com/kovapatrik/homebridge-midea-platform/commit/d89915d87b4fbdc3988853b6ff6b595eb07f8a25))
* change package name ([7054a3d](https://github.com/kovapatrik/homebridge-midea-platform/commit/7054a3da2236f44d7ef23aad82462d301cd6bcff))
* cleanup, remove service if condition applies ([292b26f](https://github.com/kovapatrik/homebridge-midea-platform/commit/292b26fcd826c381ed388ace17ee4a4061b2c415))
* config schema updated ([40a35d8](https://github.com/kovapatrik/homebridge-midea-platform/commit/40a35d8b9c64f6d3445a2304d1884ee1fbc32fd8))
* config UI ([#112](https://github.com/kovapatrik/homebridge-midea-platform/issues/112)) ([635691c](https://github.com/kovapatrik/homebridge-midea-platform/commit/635691c44651760b973968c9ca704debf86e58ac))
* creation of water tank sensor ([f4ea139](https://github.com/kovapatrik/homebridge-midea-platform/commit/f4ea139bdc489a3c81af6a5b860ef39458d4d9d9))
* debug device name, node compatibility ([eca227d](https://github.com/kovapatrik/homebridge-midea-platform/commit/eca227deb3fca13cd4e4a0c66659d3d85cba5cc2))
* description ([672c5ea](https://github.com/kovapatrik/homebridge-midea-platform/commit/672c5eacd61226512bacb07933009b7045e336ed))
* error to warning ([fa790c7](https://github.com/kovapatrik/homebridge-midea-platform/commit/fa790c7f20e3cdca3218c39c33e12dba36fdb20f))
* handling of missing credentials ([5eedc88](https://github.com/kovapatrik/homebridge-midea-platform/commit/5eedc88e605c2866137755cbfea19fe4b00fa12d))
* handling of protocol version 2 devices ([#40](https://github.com/kovapatrik/homebridge-midea-platform/issues/40)) ([cbfc766](https://github.com/kovapatrik/homebridge-midea-platform/commit/cbfc7662ce1c4ed2063aa552683923eeaf55ffbc))
* integer to number ([51a2064](https://github.com/kovapatrik/homebridge-midea-platform/commit/51a206495c7eab578b95ad3fad8d38c21ad8d8bf))
* login, token getting issues ([#130](https://github.com/kovapatrik/homebridge-midea-platform/issues/130)) ([a11e116](https://github.com/kovapatrik/homebridge-midea-platform/commit/a11e11662f3b3b3723b1ac816c26ab3c5ce299c3))
* missing credential settings ([ccb2f3d](https://github.com/kovapatrik/homebridge-midea-platform/commit/ccb2f3d20244df6267920b26be297ade40d94af9))
* more logging while discovering ([db1de95](https://github.com/kovapatrik/homebridge-midea-platform/commit/db1de95936e68ea29b42fd63e0a1e17824371d31))
* more logging while discovering ([775d657](https://github.com/kovapatrik/homebridge-midea-platform/commit/775d657f72ed60566825fc828a7bb9a52a694d1b))
* name of the plugin ([6b64149](https://github.com/kovapatrik/homebridge-midea-platform/commit/6b64149d474f9fcb052914f6e50247d61d8ba4d8))
* need of token/key only for v3 devices ([#44](https://github.com/kovapatrik/homebridge-midea-platform/issues/44)) ([a1fec01](https://github.com/kovapatrik/homebridge-midea-platform/commit/a1fec01223eeb69ab3f716eae88f3f2757c73495))
* NetHome Plus login ([d80a667](https://github.com/kovapatrik/homebridge-midea-platform/commit/d80a667ebac2d16393ed558d115fbf6ee1b6cdcd))
* NetHome Plus login ([#1](https://github.com/kovapatrik/homebridge-midea-platform/issues/1)) ([106c845](https://github.com/kovapatrik/homebridge-midea-platform/commit/106c845b4bd8d88de2c151c4c97a96f341b43909))
* NetHomePlus, eco switch added ([dbd7287](https://github.com/kovapatrik/homebridge-midea-platform/commit/dbd7287b86e3e6e036ddf0aa1dc70b5b30798f48))
* NetHomePlus, eco switch added ([f9e1a90](https://github.com/kovapatrik/homebridge-midea-platform/commit/f9e1a90f837391687540e424d27c8a28c353353e))
* package public ([5b87bb6](https://github.com/kovapatrik/homebridge-midea-platform/commit/5b87bb6de391ab3448f78c27fe09a2432ef5afb8))
* schema, api response parse ([183af01](https://github.com/kovapatrik/homebridge-midea-platform/commit/183af0167751092de7dacea72475700d40978f60))
* **skip ci:** missing docs for FA ([a9886b3](https://github.com/kovapatrik/homebridge-midea-platform/commit/a9886b3946a903dccaa233a1183ef1bef8c0e810))
* **skip ci:** order of settings attributes ([8305b6e](https://github.com/kovapatrik/homebridge-midea-platform/commit/8305b6e1d527256ed041060dac7a22d37c97c1db))
* **skip ci:** release date of new version ([46e66ba](https://github.com/kovapatrik/homebridge-midea-platform/commit/46e66bac852d49d03dd67b1493b6c4f63660a170))
* temperature related field type change ([d4b9785](https://github.com/kovapatrik/homebridge-midea-platform/commit/d4b978510abbea80d9ade8c6d077460126354253))
* this to device ([c9cc87c](https://github.com/kovapatrik/homebridge-midea-platform/commit/c9cc87ca8cf4dbbed2490cf6ad888ea46de5277d))
* tslint errors ([0736134](https://github.com/kovapatrik/homebridge-midea-platform/commit/0736134e82b4acc915c819c1d5b310c74be0fa5e))
* version ([5ffc0c7](https://github.com/kovapatrik/homebridge-midea-platform/commit/5ffc0c76eb7d5a770bca15cf627bc63313cc0a73))
* warn instead of error ([c309c5f](https://github.com/kovapatrik/homebridge-midea-platform/commit/c309c5fd219ec67d17f23c9b04addd062788e8eb))

## 2024-10-26
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

# v1.1.0
## 2024-07-13
- BREAKING CHANGE: `Air Conditioner` configuration changed: there is now a possibility to create an accessory which can be used to control the slats on the unit. THe configuration structure has changed. Please check [AC docs](/docs/ac.md) for more information (or just save the configuration again in the plugin settings to get the new structure).
- feat: added support for `Fans` (fixes #74)
- feat: added feature to turn off the display by default on power on for `Air Conditioners`
- feat: ability to change the temperature display unit from the Home app for `Air Conditioners`
- fix: default temperature unit display for `Air Conditioners` (previously the `fahrenheit` setting didn't work)
- fix: added option to add a seperate humidity sensor to `Dehumidifiers` (fixes #88)
- fix: added option to add a fan accessory to `Dehumidifiers` (fixes #89)
- fix: wait for device response before adding it to Homebridge

# v1.0.6
## 2024-06-15
- BREAKING CHANGE: there is a new conifguration option `fanOnlyModeSwitch` which will only turn on fan only mode. There is a possiblity to create an accessory to manage fan only mode using option `fanAccessory`. Setting fan to auto mode can be done from the fan accessory
- fix: NetHome Plus login
- minor quality of life improvements
