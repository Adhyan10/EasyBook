export const sendOk = (res, data, status = 200) =>
  res.status(status).json({ success: true, data, error: null });
