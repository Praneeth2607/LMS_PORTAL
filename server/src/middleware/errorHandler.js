import env from '../config/env.js';

export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// Throw an error with a `status` property from anywhere to control the code.
// Express 5 forwards rejected promises from async handlers here automatically.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message: status >= 500 && env.isProduction ? 'Internal server error' : err.message,
    ...(err.details && { errors: err.details }),
  });
};
