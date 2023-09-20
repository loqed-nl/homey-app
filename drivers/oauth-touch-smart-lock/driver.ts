import SmartLockDevice from "./device";
import LoqedOAuth2Client, { BoltState, Lock } from "../../lib/LoqedOAuth2Client";
import { Device, FlowCardAction, FlowCardTriggerDevice } from "homey";

const { OAuth2Driver } = require('homey-oauth2app');

interface KeyStateParams {
  key: {
    name: string
  }
  boltState: BoltState
}

interface GuestAccessModeParams {
  guest_access_mode: 'enabled' | 'disabled' | 'enabled_or_disabled'
}

interface GuestAccessModeTokens {
  guest_access_mode: boolean
}
interface OnPairListProps {
  oAuth2Client: typeof LoqedOAuth2Client;
}

// interface Cache {
//   locks: {
//     data: Lock[] | null,
//     date: number | null
//   }
// }

module.exports = class TouchSmartLockDriver extends OAuth2Driver {
  
  //static OAUTH2_CONFIG_ID = '$new';
  
  private keyStateTrigger: FlowCardTriggerDevice | undefined;
  private openedTrigger: FlowCardTriggerDevice | undefined;
  private guestAccessModeChangedTrigger: FlowCardTriggerDevice | undefined;
  
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

    this.guestAccessModeChangedTrigger = this.homey.flow.getDeviceTriggerCard("guest_access_mode_changed")
      .registerRunListener(async (args: GuestAccessModeParams, state: GuestAccessModeParams) => {
        console.log('run listener guest_access_mode_changed', args.guest_access_mode, state.guest_access_mode)
        return args.guest_access_mode=== "enabled_or_disabled" || args.guest_access_mode === state.guest_access_mode;
      })

    this.openAction = this.homey.flow.getActionCard('open')
      .registerRunListener(async (args: { device: typeof SmartLockDevice }, state: any) => {
        const device: typeof SmartLockDevice = args.device;

        await device.changeLockState(BoltState.OPEN);
        await device.setCapabilityValue('locked', false);
        await device.oAuth2Client.changeBoltState(device.getData().id, BoltState.OPEN);
      });
  }

  async onPairListDevices({ oAuth2Client }: OnPairListProps) {
    const devices: { data: Lock[] } = await oAuth2Client.getLocks();
    //this.log('devices', devices);

    return devices.data.map(device => {
      const capabilities = device.supported_lock_states.length > 2 ? 
      ['locked', 'measure_battery', 'open'] :
      ['locked', 'measure_battery'];

      return {
        name: device.name,
        data: {
          id:device.id
        },
        store: {
          guest_access_mode:device.guest_acces_mode,
          bolt_state:device.bolt_state,
          touch_to_connect:device.touch_to_connect,
          twist_assist:device.twist_assist
        },
        capabilities
      };
    });
  }

  async getDeviceInfo(device: typeof SmartLockDevice) {
    const oauth2Client: LoqedOAuth2Client = device.oAuth2Client;
    const getLocks = await oauth2Client.getLocks();

    const result = getLocks.data?.find((lock: Lock) => lock.id === device.getData().id);
    if(result && result.bolt_state) result.bolt_state = <BoltState>result.bolt_state.toUpperCase();
    return result;
  }

  async triggerUserStateFlow(device: Device, state: KeyStateParams) {
    this.keyStateTrigger
      ?.trigger(device, {}, state)
      .then(()=>{})
      .catch(this.error);
  }

  async triggerOpenedFlow(device: Device, state: undefined) {
    this.openedTrigger
      ?.trigger(device, {}, state)
      .then(()=>{})
      .catch(this.error);
  }
  async triggerGuestAccessModeFlow(device: Device, state: GuestAccessModeParams, tokens:GuestAccessModeTokens) {
    this.guestAccessModeChangedTrigger
      ?.trigger(device, tokens, state)
      .then(()=>{})
      .catch(this.error);
  }
}
