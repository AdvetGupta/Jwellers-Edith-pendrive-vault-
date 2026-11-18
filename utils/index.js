const response = require('./response');
const pagination = require('./pagination');
const formatters = require('./formatters');

module.exports = { ...response, ...pagination, ...formatters, response, pagination, formatters };
