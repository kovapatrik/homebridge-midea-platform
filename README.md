# Homebridge Midea-Platform Plugin
<!--
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
 -->
[![npm](https://badgen.net/npm/v/homebridge-midea-platform/latest?icon=npm&label)](https://www.npmjs.com/package/homebridge-midea-platform)
[![npm](https://badgen.net/npm/dt/homebridge-midea-platform?label=downloads)](https://www.npmjs.com/package/homebridge-midea-platform)

*Unofficial* plugin for Midea. This is implemented by building on the Homebridge platform plugin template and the work done by [@georgezhao2010](https://github.com/georgezhao2010) in the [midea_ac_lan](https://github.com/georgezhao2010/midea_ac_lan) project for Home Assistant.

**Warning** this plugin is new and not fully tested for all devices.

Pull requests and/or other offers of development assistance gratefully received.

## Features

Currently supports the following devices:

* Air Conditioner (0xAC)
* Humidifier (0xA1)

## Installation

**Option 1: Install via Homebridge Config UI X:**

Search for "midea" in [homebridge-config-ui-x](https://github.com/oznu/homebridge-config-ui-x) and install `homebridge-midea-platform`.

**Option 2: Manually Install:**

```text
sudo npm install -g homebridge-midea-platform
```

Midea device status is retrieved over your Local Area Network (LAN) and credentials are obtained from the Midea cloud services over the internet. While the plugin maintains a status cache, **use of Homebridge [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges)** is strongly encouraged. As noted below in the *network resiliency* section, this plugin will make multiple attempts to fulfill a request if necessary, which can take time.

## Configuration

### Homebridge Config UI X

[Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x) is the easiest way to configure this plugin.

### Configuration File

```json
"platforms": [
        {
            "name": "Midea",
            "platform": "midea",
            "user": "<email address>",
            "password": "<password>",
            "registeredApp": "Midea SmartHome (MSmartHome)",
            "refreshInterval": 30,
            "heartbeatInterval": 10,
            "forceLogin": false,
            "verbose": false,
            "logRecoverableErrors": true,
            "devices": [
                {
                    "type": "dehumidifier",
                    "name": "Dehumidifier",
                    "ip": "192.168.1.100",
                    "deviceId": "123456789012345",
                    "config": {
                        "token": "ABCDEF1234567890",
                        "key": "1234567890ABCDEF",
                        "verbose": false,
                        "logRecoverableErrors": true,
                        "<device_options>": {
                            "device_option": "value"
                        }
                    }
                }
            ]
        }
    ]
```
* **Platform Properties**
  * **name** *(required)*: Platform name, set to 'Midea'.
  * **platform** *(required)*: Platform identifier, set to 'midea'.
  * **user** *(optional)*: Email address / userid that you use to login to the Midea cloud service.
  * **password** *(optional)*: Password for Midea cloud service
  * **registeredApp** *(optional)*: Name of the Midea mobile app that you registered your userid and password with.  Defaults to *Midea SmartHome (MSmartHome)*, but you can also select *NetHome Plus* or *Meiju*.
  
    The *user*, *password* and *registeredApp* settings are optional and only required if you need to connect to the Midea cloud server to retrieve device credentials (Token/Key pair) -- which is required if you add a new device to your network.
    
    If you know the *deviceId* and credentials for a device then you can set them in the *devices* array, but even this is not necessary as the plugin will cache credentials retrieved from the Midea cloud server.  Once a device is setup, and credentials cached, these settings can be removed (or set to blank).
  * **refreshInterval** *(optional)*: Frequency in seconds that the plugin will query a device for status. The plugin maintains a cache of device status so that it can respond quickly to state requests from HomeKit without having to send a request to the Midea device.  Many Midea devices will automatically notify the plugin of any status change (e.g. temperature or humidity) but the plugin will also regularly request status from each device at the interval specified. The default is 30 seconds, the maximum is 86400 (24 hours). Setting value to 0 (zero) disables polling and updates will only be noted if devices sends it automatically.
  * **heartbeatInterval** *(optional)*: Frequency in seconds that the plugin will send a heartbeat message to a device to keep the network socket open. The default and minimum is 10 seconds, you can increase this up to a maximum of 120 (2 minutes). If you see socket closed messages in the log reduce this value.
  * **forceLogin** *(optional)*: Force the plugin to always login to Midea cloud servers and retrieve new credentials when the plugin initializes, overwriting previously cached credentials and ignoring *token/key* set in *devices* array. If set to true then the *user*, *password* and *registeredApp* settings are required. This setting is useful for debuging and should normally be left at its default value of false.
  * **verbose** *(optional)*: Enables more verbose debug logging.  This requires that Homebridge is run with debug mode enabled and will add additional network traffic details to the log. Default is false. See *logging* section below.
  * **logRecoverableErrors** *(optional)*: Enables logging of recoverable warning or error messages.  Default is true.  See *logging* and *network resiliency* sections below.
  * **devices** *(optional)*: Optional array of device settings, see below.

* **Devices** is an array of objects that allow settings or overrides on a device-by-device basis. This array is optional but if provided contains the following fields:
  * **type** *(required)*: Must be set to one of the supported devices.
  * **name** *(optional)*: This replaces the name set by the Midea device and is displayed in the Homebridge accessories page. Entries in the log are prefixed with this name to assist in identifying the source of information being logged.
  * **ip** *(optional)*: IP Address of the device. **Caution**, IP address for a device may change, a more reliable method of uniquely tagging a device is to use the Midea *deviceID*.
  * **deviceId** *(optional)*: ID to identify specific device. You can find this from the Homebridge log during plugin initialization or in the Homebridge Config UI X by clicking on an accessory settings and copying the *Product Data* field.
  * **config** *(optional)*: Object with settings specific for this device:
    * **token** *(optional)*: Device login token.
    * **key** *(optional)*: Device login key. Specifying a token/key pair will override any values previously cached by the plugin and avoid the need to login to the Midea cloud servers to retrieve device credentials. In addition it will also allow a device to be registered even if it is offline during plugin initialization.
    * **verbose** *(optional)*: Override global setting for this one device.
    * **logRecoverableErrors** *(optional)*: Override global setting for this one device.
    * **<device_options>** *(optional)*: Object with name and options that are device type specific.  See *device notes* below.

## Device Discovery

When the plugin initializes it attempts to find all devices attached to the Local Area Network (LAN).  It first sends a message to devices configiured in the *devices* array with a specified IP address, it then sends a message to the broadcast address of each network interface's IP subnet attached to the Homebridge server.  Midea devices attached to the network will respond and are added as Homebridge accessories.  Network discovery is repeated multiple times (currently 4 times at interval of 3 seconds between each).  At the end of the  process details of all devices discovered is sent to the Homebridge log.  This is useful if you want to record device credentials in the *devices* array.

At the end of the discovery process, if there are devices configured in the *devices* array with IP or deviceID that were not discovered, then a warning is noted in the log. If the device configiration includes *name, type, ip, deviceId, token* and *key* then the plugin will register an accessory for the device even if it is offline. When the device comes back online then it will function normally without requiring a restart.

## Device Notes

Observed behavior of various devices, and specific configuration settings are noted below for supported devices. 

### Air Conditioner

Providing air conditioner settings is optional and the whole section or individual options may be ommitted and default values (noted below) will be used. Within the *devices.config* object the following air conditioner specific options.

```json
"AC_options": {
    "singleAccessory": true,
    "swingMode": "Both",
    "outDoorTemp": false,
    "audioFeedback": false,
    "ecoSwitch": true,
    "switchDisplay": {
        "flag": true,
        "command": false
    },
    "minTemp": 16,
    "maxTemp": 30,
    "tempStep": 1,
    "fahrenHeit": false,
    "fanOnlyMode": false
}
```

* **Air Conditioner options**
  * **singleAccessory** *(optional)*: Toggles if the AC and the optional sub accessories (e.g.: outdoor temperature sensor, display switch) are combined into one accessory or not. Default is true.
  * **swingMode** *(optional)*: Set swing mode of the unit. If you AC does not support this feature then leave it on None.
  * **outDoorTemp** *(optional)*: Toggles if the outdoor temperature is created with the accessory, default is false.
  * **audioFeedback** *(optional)*: Toggles if the unit beeps when a command is sent, default is false.
  * **ecoSwitch** *(optional)*: Toggles if the ECO mode switch is created with the accessory, default is true.
  * **switchDisplay** *(optional)*: Object with following two options...
    * **flag** *(optional)*: Toggles if a switch, which can turn the display on or off will be created or not. Default is true.
    * **command** *(optional)*: Use this if the switch display command does not work. If it doesn't work either way then you unit does not support this feature. Default is false. 
  * **minTemp** *(optional)*: The minimum temperature that the unit can be set for.  Default is 16 celsius
  * **maxTemp** *(optional)*: The maximum temperature that the unit can be set for.  Default is 30 celsius
  * **tempStep** *(optional)*: Increment in which the temperature setting can be changed, may be set to either 0.5 or 1 degree celsius.  The default is one degree.
  * **fahrenHeit** *(optional)*: Toggles if the temperature on the unit is displayed in Fahrenheit or Celsius.  Default is false (displays in Celsius).
  * **fanOnlyMode** *(optional)*: Toggles if the fan only mode is created with the accessory. Default is false.

### Dehumidifier

Providing dehumidifier settings is optional and the whole section or individual options may be ommitted and default values (noted below) will be used. Within the *devices.config* object the following dehumidifier specific options.

```json
"A1_options": {
    "minHumidity": 35,
    "maxHumidity": 85,
    "humidityStep": 5
}
```

* **Dehumidifier options**
  * **minHumidity** *(optional)*: The minimum relative humidity that the unit can be set for.  Default is 35%
  * **maxHumidity** *(optional)*: The maximum relative humidity that the unit can be set for.  Default is 85%
  * **humidityStep** *(optional)*: Increment in which the relative himidity setting can be changed, may be set to either 5% or 10%.  The default is 5%.

### Unsupported Devices

If you have a device not supported by the plugin then useful information will be logged as warnings.  If you are interested in developing support for a device please contact the authors by opening an [issue](https://github.com/kovapatrik/homebridge-midea-platform/issues).

## Technical Notes

### Network Resiliency

Various strategies are employed in an attempt to handle an unstable network. If a failure occurs at any point while accessing the network or Midea devices then the plugin will attempt to reconnect.  During testing we have observed that if a Midea device is isolated from the public internet, and therefore unable to connect to Midea cloud servers, it will close the internal LAN connection to this plugin after a few minutes.  The plugin is able to recover and reopen this connection.  See *logging* setion below.

### Logging

Device status changes, for example temperature or humidity changes are logged into the Homebridge log as are any warnings or errors.  This includes errors that the plugin can recover from.  If your log is filling up with recoverable errors you can suppress these by setting *logRecoverableErrors* to false.  You can turn on debug log by running Homebridge with debug enabled, in the Homebridge UI you can set this in Homebridge Settings.  By default the plugin does not debug-log all network traffic.  If you are developing support for a new device it may be helpful to turn this on by setting *verbose* to true.

## License

Copyright (c) 2023 [Kovalovszky Patrik](https://github.com/kovapatrik),  
Copyright (c) 2023 [David A. Kerr](https://github.com/dkerr64)

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this program except in compliance with the License. You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

### Trademarks

Apple and HomeKit are registered trademarks of Apple Inc.

Midea is a trademark of Midea Group Co., Ltd.
