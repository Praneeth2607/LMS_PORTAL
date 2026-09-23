import env from '../config/env.js';

export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// PostgreSQL error codes that are the client's fault rather than a server bug.
const PG_ERRORS = {
  23505: [409, 'A record with these details already exists'],
  23503: [409, 'This action conflicts with related records'],
  23514: [400, 'A value is outside the allowed range'],
  23502: [400, 'A required value is missing'],
  '22P02': [400, 'Invalid value format'],
  22007: [400, 'Invalid date or time'],
  22008: [400, 'Invalid date or time'],
  22001: [400, 'A value is too long'],
};

// Throw an HttpError (utils/httpError.js) from anywhere to control the response.
// Express 5 forwards rejected promises from async handlers here automatically.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message;

  if (err.type === 'entity.parse.failed') {
    message = 'Request body is not valid JSON';
  } else if (err.type === 'entity.too.large') {
    message = 'Request body is too large';
  } else if (!err.status && PG_ERRORS[err.code]) {
    [status, message] = PG_ERRORS[err.code];
  }

  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message: status >= 500 && env.isProduction ? 'Internal server error' : message,
    ...(err.details && { errors: err.details }),
  });
};
