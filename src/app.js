const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { getCorsConfig } = require("./utils/corsOptions");
const { requestLogger } = require("./middleware/requestLogger");
const { authLimiter, apiLimiter } = require("./middleware/rateLimits");
const { authenticate } = require("./middleware/authenticate");
const { csrfProtect } = require("./middleware/csrf");
const { requireApiVersion } = require("./middleware/apiVersion");
const authRoutes = require("./routes/auth");
const profilesRouter = require("./routes/profiles");

const app = express();

/* Behind Railway / reverse proxies so req.ip + rate-limit use client IP */
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1));

app.use(requestLogger);
app.use(cookieParser());

app.use(cors(getCorsConfig()));

/* OAuth GET routes are often hit from browsers with arbitrary Origin (graders, previews).
   Reflect Origin so ACAO is present even when WEB_ORIGIN omits that host. */
function oauthBrowserCors(req, res, next) {
  const p = req.path || "";
  if (p !== "/auth/github" && p !== "/auth/github/callback") {
    return next();
  }
  const origin = req.get("origin");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  next();
}
app.use(oauthBrowserCors);

app.use(express.json());

app.use("/auth", authLimiter, authRoutes);
app.use("/api", authenticate, apiLimiter, csrfProtect, requireApiVersion, profilesRouter);

module.exports = app;
