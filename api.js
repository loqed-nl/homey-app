const Homey = require('homey');

module.exports = [
  {
    method: 'POST',
    path: '/',
    public: true,
    fn: function( args, callback ) {
      console.log(args);

      Homey.ManagerDrivers.getDriver('touch-smart-lock').getDevices().forEach((device) => {
        console.log(device.getData());
      })

      try {
        let touchSmartLock = Homey.ManagerDrivers
          .getDriver("touch-smart-lock")
          .getDevice({"id": args.body.lock_id});

        touchSmartLock.setState(args.body.requested_state, args.body.key_account_email);
      } catch (error) {
        callback(error, false);
      }

      callback(null, 'success');
    }
  }
]
