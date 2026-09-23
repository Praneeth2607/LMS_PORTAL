// Standard success envelope: { success: true, message?, data }
export const sendSuccess = (res, data, message, status = 200) => {
  res.status(status).json({
    success: true,
    ...(message && { message }),
    data,
  });
};

export const sendCreated = (res, data, message) => sendSuccess(res, data, message, 201);
