import { Device, FlowCard } from "homey";
import LoqedOAuth2Client, { BoltState, Lock } from "./LoqedOAuth2Client";
import SmartLockDevice from "../drivers/oauth-touch-smart-lock/device";

const Homey = require('homey');
const {OAuth2App} = require('homey-oauth2app');

export interface WebhookMessage {
  key_name_user?: string;
  key_account_email?: string;
  requested_state?: BoltState;
  event_type?: string;
  value2?: string;
  key_name_admin?: string;
  value1?: string;
  value3?: string;
  key_account_name?: string;
  key_local_id?: string;
  lock_id: string;
  battery_percentage?: number | undefined;
}

module.exports = class LoqedApp extends OAuth2App {
  static OAUTH2_CLIENT = LoqedOAuth2Client;
  static OAUTH2_DEBUG = false;
  static OAUTH2_DRIVERS = ['oauth-touch-smart-lock'];
  static OAUTH2_MULTI_SESSION = true;
  //static webhook = null;
    
  async onOAuth2Init() {
    
    if (process.env.DEBUG === '1' || false) {
      try {
        require('inspector').waitForDebugger();
      }
      catch (error) {
        require('inspector').open(9101, '0.0.0.0', true);
      }
    }

    const homeyId = await this.homey.cloud.getHomeyId();
    
    this.webhook = await this.homey.cloud.createWebhook(Homey.env.WEBHOOK_ID, Homey.env.WEBHOOK_SECRET, {homeyId});

    this.webhook.on('message', ({body, query, headers}: { body: WebhookMessage, query:object, headers:object }) => {
      //this.log('webhook body', body);
      // this.log('webhook query', query);
      // this.log('webhook headers', headers);
      const driver = this.homey.drivers.getDriver('oauth-touch-smart-lock');
      const devices = driver.getDevices();
      //this.log('devices:\n', devices);
      if(body.key_name_admin === 'Homey') return;
      const device: typeof SmartLockDevice = devices.find((device: Device) => {
        //'device id:\n', device.getData().id);
        return String(device.getData().id) === String(body.lock_id);
      });
      if (!device) return;

      device.onWebhook(body).catch(this.error);
    });

    if (!await this.homey.settings.get('notification_version_3_rewrite')) {
			this.homey.notifications.createNotification({ excerpt: this.homey.__('notifications.notification_version_3_rewrite') });
			this.homey.settings.set('notification_version_3_rewrite', true);
		}


  }

  
  async onUninit() {
    if(this.webhook) await this.webhook.unregister();
  }
}
