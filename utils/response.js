function success(data, message = null) {
  const response = { success: true };
  if (data !== undefined && data !== null) {
    response.data = data;
  }
  if (message) {
    response.message = message;
  }
  return response;
}

function successPaginated(data, pagination, message = null) {
  const response = {
    success: true,
    data,
    pagination
  };
  if (message) {
    response.message = message;
  }
  return response;
}

function failure(code, message, details = null) {
  const response = {
    success: false,
    error: { code, message }
  };
  if (details) {
    response.error.details = details;
  }
  return response;
}

module.exports = { success, successPaginated, failure };
