# Air Conditioner

## Auto mode

This setting is only makes sense and works, if your device can handle heating, and if the `heatingCapable` option is set to `true`.

The `Auto` mode is emulated, because Midea devices are only providing a single target temperature, there are no separate temperatures for cooling and heating. In `Auto` mode it's possible to change the cooling and heating target thresholds. Here is how they are working in each mode:

- Cool: target temperature is the cooling threshold
- Heat: target temperature is the heating threshold
- Auto: if the indoor temperature is below the heating threshold, set the target temperature to the heating threshold; if the indoor temperature is above the cooling threshold, set the target temperature to the cooling threshold; if the temperature is within the band set the target temperature to the current indoor temperature so the devices stays idle and save energy

## Configuration

Providing air conditioner settings is optional and the whole section or individual options may be ommitted and default values (noted below) will be used. Within the _devices.config_ object the following air conditioner specific options.

```json
"AC_options": {
    "swing": {
        "mode": "None",
        "angleAccessory": false,
        "angleMainControl": "Vertical"
    },
    "heatingCapable": true,
    "outDoorTemp": false,
    "audioFeedback": false,
    "screenOff": false,
    "ecoSwitch": false,
    "dryModeSwitch": false,
    "boostModeSwitch": false,
    "breezeAwaySwitch": false,
    "displaySwitch": {
        "flag": true,
        "command": false
    },
    "auxHeatingSwitches": false,
    "selfCleanSwitch": false,
    "ionSwitch": false,
    "rateSelector": false,
    "minTemp": 16,
    "maxTemp": 30,
    "tempStep": 1,
    "fahrenheit": false,
    "fanOnlyModeSwitch": false,
    "fanAccessory": false,
    "sleepModeSwitch": false,
    "sleepModeAccessory": false
}
```

## Options

- **swing**:
  - **mode** _(optional)_: Set swing mode of the unit. If your unit does not support this feature then leave it on `None`. Default is `None`.
  - **angleAccessory** _(optional)_: Toggles if the swing angle accessory is created with the accessory. The accessory can be used to set the angle of the slat to a specified value. The `mode` property will be used to determine the direction of the slat. The main position bar will be used to set the angle of the direction which is selected in the `mode` property. Default is `false`.
  - **angleMainControl** _(optional)_: If `mode` property is Both and the swing angle accessory is enabled, this property will be used to determine which direction will be controlled by the main position bar of the accessory. Default is `Vertical`.
- **heatingCapable** _(optional)_: Toggles if the unit is capable of heating. Default is `true`.
- **outDoorTemp** _(optional)_: Toggles if the outdoor temperature sensor is created with the accessory. Default is `false`.
- **audioFeedback** _(optional)_: Toggles if the unit beeps when a command is sent, default is false.
- **screenOff** _(optional)_: Toggles if the screen is turned off by default when the unit is turned on. Default is `false`.
- **ecoSwitch** _(optional)_: Toggles if the eco switch is created with the accessory. Default is `false`.
- **dryModeSwitch** _(optional)_: Toggles if the dry mode switch is created with the accessory. Default is `false`.
- **boostModeSwitch** _(optional)_: Toggles if the boost/turbo mode switch is created with the accessory. Default is `false`.
- **breezeAwaySwitch** _(optional)_: Toggles if the breeze away switch is created with the accessory. Default is `false`.
- **displaySwitch**:
  - **flag** _(optional)_: Toggles if a switch, which can turn the display on or off will be created or not. Default is `true`.
  - **command** _(optional)_: Use this if the switch display command does not work. If it doesn't work either way then you unit does not support this feature. Default is `false`.
- **auxHeatingSwitches** _(optional)_: Toggles if the aux heating switches are created with the accessory. Default is `false`.
- **selfCleanSwitch** _(optional)_: Toggles if the self-cleaning switch is created with the accessory. Default is `false`.
- **ionSwitch** _(optional)_: Toggles if the ION switch is created with the accessory. Default is `false`.
- **rateSelector** _(optional)_: Toggles if the gear selector is created with the accessory. Default is `false`.
- **minTemp** _(optional)_: The minimum temperature that the unit can be set for. Default is `16 celsius`
- **maxTemp** _(optional)_: The maximum temperature that the unit can be set for. Default is `30 celsius`
- **tempStep** _(optional)_: Increment in which the temperature setting can be changed, may be set to either 0.5 or 1 degree celsius. The default is `1 degree`.
- **fahrenheit** _(optional)_: Toggles if the temperature on the unit is displayed in Fahrenheit or Celsius. Default is `false` (displays in Celsius).
- **fanOnlyModeSwitch** _(optional)_: Toggles if the fan only mode switch is created with the accessory. Default is `false`.
- **fanAccessory** _(optional)_: Toggles if the fan accessory is created with the accessory. Default is `false`.
- **sleepModeSwitch** _(optional)_: Toggles if the sleep mode switch is created with the accessory. Default is `false`.
