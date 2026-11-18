const { categoryService } = require('../../services');

const handlers = [
  {
    channel: 'category:list',
    handler: async () => {
      return categoryService.getAll();
    }
  }
];

module.exports = handlers;