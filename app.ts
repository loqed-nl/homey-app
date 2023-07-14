import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

const Homey = require('homey');
const LoqedApp = require('./lib/LoqedApp')

// class LoqedApp extends Homey.App {
//   async onInit() {
//     this.log('LoqedApp has been initialized');
//
//     const id = Homey.env.WEBHOOK_ID;
//     const secret = Homey.env.WEBHOOK_SECRET;
//
//     const myWebhook = await this.homey.cloud.createWebhook(id, secret, {});
//
//     myWebhook.on('message', args => {
//       const body = args.body;
//
//       return this.setLockState(body.lock_id, body.requested_state, body.key_account_email);
//     });
//   }
//
//   async setLockState(lockId, newState, keyEmail) {
//     const device = this.homey
//       .drivers
//       .getDriver('touch-smart-lock')
//       .getDevice({"id": lockId});
//
//     return new Promise(resolve => {
//       device.setState(newState, keyEmail, true);
//
//       resolve();
//     });
//   }
// }
//
// module.exports = LoqedApp;

module.exports = LoqedApp
