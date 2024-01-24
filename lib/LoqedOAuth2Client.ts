const Homey = require('homey');
const { OAuth2Client } = require('homey-oauth2app');

export interface Lock {
  id: string
  name: string
  battery_percentage: number,
  battery_type: string,
  bolt_state: BoltState,
  party_mode: boolean,
  guest_access_mode: boolean,
  open_house_mode: boolean,
  twist_assist: boolean,
  touch_to_connect: boolean,
  lock_direction: 'clockwise' | 'counter_clockwise',
  mortise_lock_type: 'cylinder_operated_no_handle_on_the_outside' | 'cylinder_operated_handle_on_the_outside' | 'handle_upward_directly_locked_cylinder_to_unlock_90_degree_and_back' | 'handle_upward_cylinder_to_lock_and_unlock' | 'handle_upward_directly_locked_cylinder_to_unlock_360_degree',
  supported_lock_states: BoltState[],
  online: boolean,
  bridge_ip: string,
  bridge_hostname: string
  local_id: number
}

export enum BoltState {
  NIGHT_LOCK = 'NIGHT_LOCK',
  DAY_LOCK = 'DAY_LOCK',
  OPEN = 'OPEN',
  UNKNOWN = 'UNKNOWN'
}

export enum OpenHouseMode {
  DISABLED = 0,
  ENABLED = 1
}

export enum TwistAssistMode {
  DISABLED = 0,
  ENABLED = 1
}

export enum TouchToConnectMode {
  DISABLED = 0,
  ENABLED = 1
}


export interface Key {
  name: string,
  administrator_name: string
}
export interface SettingArgument {
  oldSettings: {
    open_house_mode_button: Boolean,
    twist_assist_button: Boolean,
    touch_to_connect_button: Boolean,
  },
  newSettings: {
    open_house_mode_button: Boolean,
    twist_assist_button: Boolean,
    touch_to_connect_button: Boolean,
  },
  changedKeys: String[]
}

export default class LoqedOAuth2Client extends OAuth2Client {
  static API_URL = 'https://integrations.production.loqed.com';
  static TOKEN_URL = `${LoqedOAuth2Client.API_URL}/oauth/token`;
  static AUTHORIZATION_URL = `${LoqedOAuth2Client.API_URL}/oauth/authorize`;
  static SCOPES = [
    'list-locks',
    'operate-locks',
    'list-webhooks',
    'create-webhooks',
  ];
  private getLockPromise: Promise<{ data: Lock[] }> | undefined = undefined;

  public async getLocks(): Promise<{ data: Lock[] }> {
    if (!this.getLockPromise) {
      return this.getLockPromise = this.get({
        headers: { Accept: "application/json" },
        path: '/api/locks',
      })
        .finally(() => {
          this.getLockPromise = undefined;
        });
    }

    return this.getLockPromise;
  }

  static getRandomId() {
    return 'xxxxxxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; const
        // eslint-disable-next-line no-mixed-operators
        v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }


  public async createWebhook(lockId: string): Promise<{ data: { id: string } }> {
    console.log('createWebhook');
    const homeyId = await this.homey.cloud.getHomeyId();
    const webhookUrl = `https://webhooks.athom.com/webhook/${Homey.env.WEBHOOK_ID}?homey=${homeyId}`;

    return this.post({
      headers: { Accept: "application/json" },
      path: `/api/locks/${lockId}/webhooks/many`,
      json: {
        url: webhookUrl,
        info: true,
        guest_access_mode: true,
      }
    });
  };

  public async deleteWebhook(lockId: string, webhookId: string): Promise<{ data: { id: string } }> {
    const homeyId = await this.homey.cloud.getHomeyId();
    const webhookUrl = `https://webhooks.athom.com/webhook/${Homey.env.WEBHOOK_ID}?homey=${homeyId}`;

    return this.delete({
      headers: { Accept: "application/json" },
      path: `/api/locks/${lockId}/webhooks/${webhookId}`
    });
  };

  public async changeBoltState(lockId: string, boltState: BoltState) {
    return this.get({
      headers: { Accept: "application/json" },
      path: `/api/locks/${lockId}/bolt_state/${boltState}`
    })
  }


  public async changeOpenHouseMode(lockId: string, openHouseMode: OpenHouseMode) {
    return this.post({
      headers: { Accept: "application/json" },
      path: `/api/locks/${lockId}/setting`,
      json: {
        "setting_name": "open_house_mode",
        "setting_value": openHouseMode ? 1 : 0
      }
    })
  }


  public async changeTwistAssist(lockId: string, twistAssistMode: TwistAssistMode) {
    return this.post({
      headers: { Accept: "application/json" },
      path: `/api/locks/${lockId}/setting`,
      json: {
        "setting_name": "twist_assist",
        "setting_value": twistAssistMode ? 1 : 0
      }
    })
  }


  public async changeTouchToConnect(lockId: string, touchToConnectMode: TouchToConnectMode) {
    return this.post({
      headers: { Accept: "application/json" },
      path: `/api/locks/${lockId}/setting`,
      json: {
        "setting_name": "touch_to_connect",
        "setting_value": touchToConnectMode ? 1 : 0
      }
    })
  }


  public async getKeys(lockId: string): Promise<{ data: Key[] }> {
    return this._get({
      headers: { Accept: "application/json" },
      path: `/api/locks/${lockId}/keys`
    });
  }


  // private async _get(opts:Object) {
  //   if(!opts) opts = {};
  //   if(!opts.headers)opts.headers = [{"Accept":"application/json"}];

  //   return this.get(opts);
  // }
}
