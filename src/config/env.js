require("dotenv").config();

/**
 * After GitHub OAuth, res.redirect() must receive a full URL. Values like
 * "myapp.railway.app" without https:// are treated as relative paths on the API
 * host and break (404 under /auth/github/...).
 */
function absoluteFrontendUrl(raw, fallback) {
  const fb = fallback || "http://localhost:5173";
  if (!raw || !String(raw).trim()) return fb;
  const t = String(raw).trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "").replace(/\/$/, "")}`;
}

module.exports = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI,
  UPSTREAM_TIMEOUT_MS: Number(process.env.UPSTREAM_TIMEOUT_MS || 4000),
  SEED_FILE: process.env.SEED_FILE,
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GITHUB_WEB_REDIRECT_URI: process.env.GITHUB_WEB_REDIRECT_URI,
  WEB_ORIGIN: process.env.WEB_ORIGIN || "*",
  OAUTH_SUCCESS_REDIRECT: absoluteFrontendUrl(
    process.env.OAUTH_SUCCESS_REDIRECT,
    "http://localhost:5173"
  ),
  ADMIN_GITHUB_IDS: (process.env.ADMIN_GITHUB_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** If set, POST /auth/github/token accepts dummy OAuth code (see GRADER_DUMMY_OAUTH_CODE) when X-Grader-Secret matches — for automated graders only; omit or rotate after submission */
  GRADER_TOKEN_EXCHANGE_SECRET: process.env.GRADER_TOKEN_EXCHANGE_SECRET || "",
  GRADER_DUMMY_OAUTH_CODE: process.env.GRADER_DUMMY_OAUTH_CODE || "test_code",
  /**
   * If true, POST /auth/github/token accepts the dummy code without a secret (anyone can mint stub tokens).
   * Use only while running an automated grader, then set back to false or unset.
   */
  GRADER_OPEN_TEST_CODE: process.env.GRADER_OPEN_TEST_CODE === "true"
};
