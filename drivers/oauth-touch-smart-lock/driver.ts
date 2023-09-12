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

interface OpenHouseModeParams {
  mode: 'enabled' | 'disabled'
}

interface OnPairListProps {
  oAuth2Client: typeof LoqedOAuth2Client;
}

interface Cache {
  locks: {
    data: Lock[] | null,
    date: number | null
  }
}

module.exports = class TouchSmartLockDriver extends OAuth2Driver {
  private cache: Cache = {
    locks: {
      data: null,
      date: null
    }
  };
  private keyStateTrigger: FlowCardTriggerDevice | undefined;
  private openedTrigger: FlowCardTriggerDevice | undefined;
  private openHouseModeTrigger: FlowCardTriggerDevice | undefined;
  private openAction: FlowCardAction | undefined;

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
          this.log('keys', keys);
          return keys.data.filter((key) => (key.administrator_name || key.name).toLowerCase().includes(query.toLowerCase())).map((key) => {
            return {
              name: (key.administrator_name || key.name),
              id: key.name
            };
          })
        }
      );

    this.openHouseModeTrigger = this.homey.flow.getDeviceTriggerCard("open_house_mode")
      .registerRunListener(async (args: OpenHouseModeParams, state: OpenHouseModeParams) => {
        console.log('run listener open house mode', args.mode, state.mode)
        return args.mode === state.mode;
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

    return devices.data.map(device => {
      const capabilities = device.supported_lock_states.length > 2 ? ['locked', 'measure_battery', 'lock_state', 'house_open_button'] : ['locked', 'measure_battery', 'house_open_button'];

      return {
        name: device.name,
        data: device,
        capabilities
      };
    });
  }

  async getDeviceInfo(device: typeof SmartLockDevice) {
    const oauth2Client: LoqedOAuth2Client = device.oAuth2Client;
    const getLocks = await oauth2Client.getLocks();

    return getLocks.data?.find((lock: Lock) => lock.id === device.getData().id);
  }

  async triggerUserStateFlow(device: Device, state: KeyStateParams) {
    this.keyStateTrigger
      ?.trigger(device, {}, state)
      .then(this.log)
      .catch(this.error);
  }

  async triggerOpenedFlow(device: Device, state: undefined) {
    this.openedTrigger
      ?.trigger(device, {}, state)
      .then(this.log)
      .catch(this.error);
  }
  async triggerOpenHouseModeFlow(device: Device, state: OpenHouseModeParams) {
    return this.openHouseModeTrigger
      ?.trigger(device, {}, state);
  }
}
