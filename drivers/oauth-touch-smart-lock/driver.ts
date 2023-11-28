import SmartLockDevice from "./device";
import LoqedOAuth2Client, { BoltState, Lock, OpenHouseMode, TouchToConnectMode, TwistAssistMode } from "../../lib/LoqedOAuth2Client";
import { Device, FlowCardAction, FlowCardTriggerDevice } from "homey";

const { OAuth2Driver } = require('homey-oauth2app');

interface KeyStateParams {
  key: {
    name: string
  }
  boltState: BoltState
}

interface OpenHouseModeParams {
  open_house_mode: 'enabled' | 'disabled' | 'enabled_or_disabled'
}

interface TwistAssistParams {
  twist_assist: 'enabled' | 'disabled' | 'enabled_or_disabled'
}

interface TouchToConnectParams {
  touch_to_connect: 'enabled' | 'disabled' | 'enabled_or_disabled'
}

interface OpenHouseModeTokens {
  open_house_mode: boolean
}
interface TwistAssistTokens {
  twist_assist: boolean
}
interface TouchToConnectTokens {
  touch_to_connect: boolean
}

interface OnPairListProps {
  oAuth2Client: typeof LoqedOAuth2Client;
}


module.exports = class TouchSmartLockDriver extends OAuth2Driver {


  private keyStateTrigger: FlowCardTriggerDevice | undefined;
  private openedTrigger: FlowCardTriggerDevice | undefined;
  private openHouseModeChangedTrigger: FlowCardTriggerDevice | undefined;

  async onOAuth2Init() {
    this.openedTrigger = this.homey.flow.getDeviceTriggerCard("opened")
      .registerRunListener(async (args: undefined, state: undefined) => {
        return true;
      });

    this.keyStateTrigger = this.homey.flow.getDeviceTriggerCard("key_state")
      .registerRunListener(async (args: KeyStateParams, state: KeyStateParams) => {
        return args.key.name === state.key.name && args.boltState === state.boltState;
      })
      .registerArgumentAutocompleteListener(
        "key",
        async (query: string, args: any) => {
          const device: typeof SmartLockDevice = args.device;
          const oauth2Client: LoqedOAuth2Client = device.oAuth2Client;
          const deviceId = device.getData().id;
          const keys = await oauth2Client.getKeys(deviceId);
          //this.log('keys', keys);
          return keys.data.filter((key) => (key.administrator_name || key.name).toLowerCase().includes(query.toLowerCase())).map((key) => {
            return {
              name: (key.administrator_name || key.name),
              id: key.name
            };
          })
        }
      );

    try {
      this.openHouseModeChangedTrigger = this.homey.flow.getDeviceTriggerCard("open_house_mode_changed")
        .registerRunListener(async (args: OpenHouseModeParams, state: OpenHouseModeParams) => {
          return args.open_house_mode === "enabled_or_disabled" || args.open_house_mode === state.open_house_mode;
        })
    } catch (error) {

    }

    this.twistAssistChangedTrigger = this.homey.flow.getDeviceTriggerCard("twist_assist_changed")
      .registerRunListener(async (args: TwistAssistParams, state: TwistAssistParams) => {
        return args.twist_assist === "enabled_or_disabled" || args.twist_assist === state.twist_assist;
      })

    this.touchToConnectChangedTrigger = this.homey.flow.getDeviceTriggerCard("touch_to_connect_changed")
      .registerRunListener(async (args: TouchToConnectParams, state: TouchToConnectParams) => {
        return args.touch_to_connect === "enabled_or_disabled" || args.touch_to_connect === state.touch_to_connect;
      })

    this.openAction = this.homey.flow.getActionCard('open')
      .registerRunListener(async (args: { device: typeof SmartLockDevice }, state: any) => {
        const device: typeof SmartLockDevice = args.device;

        await device.changeOpen(BoltState.OPEN);
        await device.setCapabilityValue('locked', false);
        await device.oAuth2Client.changeBoltState(device.getData().id, BoltState.OPEN);
      });

    this.openAction = this.homey.flow.getActionCard('set_open_house_mode')
      .registerRunListener(async (args: { device: typeof SmartLockDevice, open_house_mode: Boolean }, state: any) => {
        const device: typeof SmartLockDevice = args.device;
        await device.setOpenHouseMode(args.open_house_mode, false);
        await device.oAuth2Client.changeOpenHouseMode(device.getData().id, args.open_house_mode ? OpenHouseMode.ENABLED : OpenHouseMode.DISABLED);
      });

    this.openAction = this.homey.flow.getActionCard('set_twist_assist')
      .registerRunListener(async (args: { device: typeof SmartLockDevice, twist_assist: Boolean }, state: any) => {
        const device: typeof SmartLockDevice = args.device;
        await device.setTwistAssist(args.twist_assist, false);
        await device.oAuth2Client.changeTwistAssist(device.getData().id, args.twist_assist ? TwistAssistMode.ENABLED : TwistAssistMode.DISABLED);
      });

    this.openAction = this.homey.flow.getActionCard('set_touch_to_connect')
      .registerRunListener(async (args: { device: typeof SmartLockDevice, touch_to_connect: Boolean }, state: any) => {
        const device: typeof SmartLockDevice = args.device;
        await device.setTouchToConnect(args.touch_to_connect, false);
        await device.oAuth2Client.changeTouchToConnect(device.getData().id, args.touch_to_connect ? TouchToConnectMode.ENABLED : TouchToConnectMode.DISABLED);
      });

  }

  async onPairListDevices({ oAuth2Client }: OnPairListProps) {
    const devices: { data: Lock[] } = await oAuth2Client.getLocks();

    return devices.data.map(device => {
      const capabilities = device.supported_lock_states.length > 2 ?
        ['locked', 'measure_battery', 'open', 'open_house_mode', 'twist_assist', 'touch_to_connect'] :
        ['locked', 'measure_battery', 'twist_assist', 'touch_to_connect'];

      return {
        name: device.name,
        data: {
          id: device.id
        },
        capabilities
      };
    });
  }

  async getDeviceInfo(device: typeof SmartLockDevice) {
    const oauth2Client: LoqedOAuth2Client = device.oAuth2Client;
    const getLocks = await oauth2Client.getLocks();
    //this.log('getDeviceInfo:\n', getLocks);

    const result = getLocks.data?.find((lock: Lock) => lock.id === device.getData().id);
    if (result) {
      if (result.bolt_state) result.bolt_state = <BoltState>result.bolt_state.toUpperCase();
      result.open_house_mode = result.guest_access_mode;
    }
    return result;
  }

  async triggerUserStateFlow(device: Device, state: KeyStateParams) {
    this.keyStateTrigger
      ?.trigger(device, {}, state)
      .then(() => { })
      .catch(this.error);
  }

  async triggerOpenedFlow(device: Device, state: undefined) {
    this.openedTrigger
      ?.trigger(device, {}, state)
      .then(() => { })
      .catch(this.error);
  }

  async triggerOpenHouseModeFlow(device: Device, state: OpenHouseModeParams, tokens: OpenHouseModeTokens) {
    if(this.openHouseModeChangedTrigger && device.hasCapability('open')) this.openHouseModeChangedTrigger
      ?.trigger(device, tokens, state)
      .then(() => { })
      .catch(this.error);
  }
  async triggerTwistAssistFlow(device: Device, state: TwistAssistParams, tokens: TwistAssistTokens) {
    this.twistAssistChangedTrigger
      ?.trigger(device, tokens, state)
      .then(() => { })
      .catch(this.error);
  }
  async triggerTouchToConnectFlow(device: Device, state: TouchToConnectParams, tokens: TouchToConnectTokens) {
    this.touchToConnectChangedTrigger
      ?.trigger(device, tokens, state)
      .then(() => { })
      .catch(this.error);
  }
}
