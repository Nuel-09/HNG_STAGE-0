// TRD requirement: all /api/* requests must include X-API-Version: 1.
const requireApiVersion = (req, res, next) => {
  const version = req.headers["x-api-version"];
  if (version !== "1") {
    return res.status(400).json({ status: "error", message: "API version header required" });
  }
  next();
};

module.exports = { requireApiVersion };
