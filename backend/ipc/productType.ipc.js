const { productTypeService } = require('../../services');

const handlers = [
  {
    channel: 'productType:list',
    handler: async () => {
      return productTypeService.getAll();
    }
  }
];

module.exports = handlers;