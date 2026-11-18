const { membershipService } = require('../../services');

const handlers = [
  {
    channel: 'membership:list',
    handler: async () => {
      return membershipService.getAll();
    }
  }
];

module.exports = handlers;