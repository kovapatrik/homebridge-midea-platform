# Automation Recipes

This guide provides examples of how to use the various switches and sensors provided by `homebridge-midea-platform` to create powerful automations in HomeKit (Apple Home app) or other HomeKit controllers.

## Prerequisites

To follow some of these examples, you might need additional plugins:

- [homebridge-delay-switch](https://www.npmjs.com/package/homebridge-delay-switch): For timers with triggers.
- [homebridge-dummy-legacy](https://www.npmjs.com/package/homebridge-dummy-legacy): For state persistence or virtual triggers (preferred version).

> [!NOTE]
> If you are using a **Child Bridge** for the Midea platform (recommended), you must pair it separately in HomeKit using its own QR code from the Homebridge UI.

### Configuration Example for `homebridge-dummy-legacy`

Unlike some other plugins, this one must be added to the **`accessories`** section of your `config.json`:

```json
{
  "accessory": "DummySwitch",
  "name": "AC Cool Mode Active"
}
```

## Scenario 1: Built-in Off Timer

The plugin includes a built-in timer that doesn't require extra plugins.

### Configuration

Ensure `"timerSwitch": true` is set in your `AC_options`.

### How it works

1. In HomeKit, you will see a **Valve** accessory named "Timer".
2. Open its settings to set a "Duration" (e.g., 1 hour).
3. When you turn on this "Timer", the AC will automatically turn off when the duration expires.

### Automation

- **Trigger**: When AC is turned on.
- **Action**: Turn on the "Timer".
- **Result**: Your AC will always turn off automatically after the set duration.

## Scenario 2: Advanced Auto-off (with Delay Switch)

If you want more control, like turning off the AC only if it's still running after a certain delay.

### Configuration (`homebridge-delay-switch`)

```json
{
  "accessory": "DelaySwitch",
  "name": "AC Timeout",
  "delay": 7200000,
  "startOnReboot": false
}
```

### Automations

1. **Start Timer**: When Midea AC Power is turned ON -> Turn ON "AC Timeout".
2. **Reset Timer**: When Midea AC Power is turned OFF -> Turn OFF "AC Timeout".
3. **Execution**: When "AC Timeout" Motion Sensor detects motion (triggered when timer expires) -> Turn OFF Midea AC.

## Scenario 3: Mold Prevention (Dry after Cool)

Running the fan for a few minutes after using the AC in cooling mode helps dry the internal components and prevents mold growth.

### Prerequisites

- Enable `"fanOnlyModeSwitch": true` in `AC_options`.
- A `DelaySwitch` set to 600000 ms (10 minutes).

### Automations

1. **State Tracking**:
   - When the AC changes to **Cool** mode -> Turn ON "AC Cool Mode Active" (Dummy Switch).
   - When the AC changes to a mode other than Cool -> Turn OFF "AC Cool Mode Active".
2. **Trigger**: When Midea AC is turned OFF (**Power OFF**).
3. **Condition**: If "AC Cool Mode Active" is **ON**.
4. **Action**:
   - Activate "Midea AC Fan Only".
   - Activate "Dry Timer" (Delay Switch).
5. **Cleanup**: When "Dry Timer" Motion Sensor detects motion (end of delay) -> Turn OFF "Midea AC Fan Only".

## Scenario 4: Night Mode

Turn off the noisy features and bright LED when it's time to sleep.

### Prerequisites

- Enable `"sleepModeSwitch": true`, `"displaySwitch": true`, and `"outSilentSwitch": true`.

### Automation

- **Trigger**: At 10:00 PM.
- **Condition**: If Midea AC is ON.
- **Action**:
  - Turn ON "Midea AC Sleep Mode".
  - Turn OFF "Midea AC Display".
  - Turn ON "Midea AC Outdoor Silent".

## Scenario 5: Temperature-Based Automation

Turn on the AC when it gets too hot, but only if someone is home.

### Automation

- **Trigger**: When Midea AC Temperature Sensor rises above 25°C.
- **Condition**: If anyone is at home.
- **Action**: Turn ON Midea AC (Cool mode, 22°C).

---

## Tip: Complex Automations without Eve (HomeKit Shortcuts)

If the Home app seems limited for conditions (e.g., "only IF the AC is on"), you can use the built-in **Shortcuts**:

1. Create a new automation in the Home app.
2. Choose your trigger (e.g., "A specific time of day").
3. On the accessory selection screen, scroll to the bottom and tap **"Convert to Shortcut"**.
4. You can now add an **"If"** block to check the status of a device before executing the action.

---

## Scenario 6: Maintaining Comfort (Heat / Cool)

Keep the room at an ideal temperature automatically.

### Cool Mode (Summer)

- **Trigger**: Indoor temperature rises above 25°C.
- **Action**: Set AC to **Cool** mode at 21°C.

### Heat Mode (Winter)

- **Trigger**: Indoor temperature falls below 19°C.
- **Action**: Set AC to **Heat** mode at 21°C.

_Note: The Home app allows setting these thresholds natively. If you want this to trigger only when you are home, use the "People" option in the automation settings._

## Scenario 7: Auto-Cleaning (Self Clean)

Start cleaning when the device requests it or periodically.

### Based on device status

- **Prerequisites**: Enable `"selfCleanSwitch": true` in `AC_options`.
- **Trigger**: When the AC's "Filter Change Indication" changes to "Change Filter".
- **Action**: Activate the "Midea AC Self Clean" switch.

### Periodic (Monthly)

- **Trigger**: Once a month on Sunday at 10 AM.
- **Action**: Activate "Midea AC Self Clean".

## Scenario 8: Night Eco Mode

Save energy at night without sacrificing comfort.

### Automation (Without Eve)

- **Trigger**: At 11:00 PM.
- **Action**: **Convert to Shortcut** (at the bottom of the list).
- **Shortcut Logic**:
  1. Add the **"Control [My Home]"** action -> Select the AC -> Get the status of "Power".
  2. Add an **"If"** block -> If "Power" is equal to "Yes" (On).
  3. In the "If": Add the **"Control [My Home]"** action -> Turn ON "Midea AC Eco Mode".
- **Cancellation**: Create a simple inverse rule at 7:00 AM to turn off Eco mode.

## Scenario 9: Dehumidification Mode (Dry)

Fight excessive humidity.

### Automation

- **Prerequisites**: Enable `"dryModeSwitch": true` and `"humiditySensor": true` in `AC_options`.
- **Trigger**: When indoor humidity rises above 65% (Humidity Sensor).
- **Action**: Activate the "Midea AC Dry Mode" switch.

---

## Pro-Tip: Hiding Virtual Accessories

To keep your Home app clean, you can hide the virtual switches (`DelaySwitch`, `DummySwitch`) that are only used for automations.

1. In the **Apple Home** app, long-press the accessory tile.
2. Tap **Accessory Details** (or the gear icon).
3. **Include in Home Summaries**: Turn this **OFF**. This prevents the switch from appearing in the status icons at the top of the Home tab (e.g., "1 Switch On").
4. **Show in Home View**: Turn this **OFF**. This removes the tile from your main "Home" tab. The accessory will still be visible inside its specific Room tab.
5. **Add to Favorites**: Turn this **OFF** to remove it from the Control Center.

The accessories will continue to work perfectly in your automations even when hidden.

### How to Find Hidden Accessories

If you have hidden an accessory from the Home View:

1. Tap the **Rooms** tab (or select the specific Room from the Home menu).
2. Navigate to the room where the accessory was assigned (e.g., "Living Room").
3. The accessory tile will be visible there.
4. To unhide it, long-press the tile -> **Accessory Details** -> Turn **Show in Home View** back **ON**.

---

For more details on available options, see the [Air Conditioner Documentation](ac.md).
