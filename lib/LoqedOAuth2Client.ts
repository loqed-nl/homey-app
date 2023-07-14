const Homey = require('homey');
const {OAuth2Client} = require('homey-oauth2app');

export interface Lock {
  id: string
  name: string
  battery_percentage: number,
  battery_type: string,
  bolt_state: BoltState,
  party_mode: boolean,
  guest_acces_mode: boolean,
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
  OPEN = 'OPEN'
}

export interface Key {
  name: string,
  administrator_name: string
}

export default class LoqedOAuth2Client extends OAuth2Client {
  static API_URL = 'https://integrations.production.loqed.com';
  static TOKEN_URL = `${ LoqedOAuth2Client.API_URL }/oauth/token`;
  static AUTHORIZATION_URL = `${ LoqedOAuth2Client.API_URL }/oauth/authorize`;
  static SCOPES = [
    'list-locks',
    'operate-locks',
    'list-webhooks',
    'create-webhooks',
  ];

  public async getLocks(): Promise<{ data: Lock[] }> {
    return this.get({
      path: '/api/locks',
    });
  }

  public async createWebhook(lockId: string): Promise<{ data: { id: string } }> {
    const homeyId = await this.homey.cloud.getHomeyId();
    const webhookUrl = `https://webhooks.athom.com/webhook/${ Homey.env.WEBHOOK_ID }?homey=${ homeyId }`;

    return this.post({
      path: `/api/locks/${ lockId }/webhooks`,
      json: {
        url: webhookUrl,
        info: true
      }
    });
  };

  public async changeBoltState(lockId: string, boltState: BoltState) {
    return this.get({
      path: `/api/locks/${ lockId }/bolt_state/${ boltState }`
    })
  }

  public async getKeys(lockId: string): Promise<{ data: Key[] }> {
    return this.get({
      path: `/api/locks/${ lockId }/keys`
    });
  }
}
