const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DATABASE_ERROR: 'DATABASE_ERROR',
  BACKUP_ERROR: 'BACKUP_ERROR',
  FILE_ERROR: 'FILE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_OPERATION: 'INVALID_OPERATION'
};

class AppError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toResponse() {
    const response = {
      success: false,
      error: {
        code: this.code,
        message: this.message
      }
    };
    if (this.details) {
      response.error.details = this.details;
    }
    return response;
  }

  toLog() {
    return `${this.code}: ${this.message}${this.details ? ' | ' + JSON.stringify(this.details) : ''}`;
  }

  static validation(message, details) {
    return new AppError(ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static authentication(message = 'Authentication required') {
    return new AppError(ERROR_CODES.AUTHENTICATION_ERROR, message);
  }

  static authorization(message = 'Insufficient permissions') {
    return new AppError(ERROR_CODES.AUTHORIZATION_ERROR, message);
  }

  static notFound(entity = 'Resource') {
    return new AppError(ERROR_CODES.NOT_FOUND, `${entity} not found`);
  }

  static conflict(message) {
    return new AppError(ERROR_CODES.CONFLICT, message);
  }

  static database(message, details) {
    return new AppError(ERROR_CODES.DATABASE_ERROR, message, details);
  }

  static backup(message) {
    return new AppError(ERROR_CODES.BACKUP_ERROR, message);
  }

  static file(message) {
    return new AppError(ERROR_CODES.FILE_ERROR, message);
  }

  static invalidOperation(message) {
    return new AppError(ERROR_CODES.INVALID_OPERATION, message);
  }
}

module.exports = { AppError, ERROR_CODES };
