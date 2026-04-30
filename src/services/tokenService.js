const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { RefreshToken } = require("../models/refreshToken");
const { JWT_SECRET, ACCESS_TOKEN_TTL_SEC, REFRESH_TOKEN_TTL_SEC } = require("../config/env");

const ACCESS_TTL_SEC = ACCESS_TOKEN_TTL_SEC;
const REFRESH_TTL_MS = REFRESH_TOKEN_TTL_SEC * 1000;

const hashToken = (plain) => crypto.createHash("sha256").update(plain).digest("hex");

const signAccessToken = (user, ttlSec = ACCESS_TTL_SEC) => {
  if (!JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      github_id: user.github_id
    },
    JWT_SECRET,
    { expiresIn: ttlSec }
  );
};

const verifyAccessToken = (token) => {
  if (!JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return jwt.verify(token, JWT_SECRET);
};

const issueRefreshToken = async (userId, ttlMs = REFRESH_TTL_MS) => {
  const plain = crypto.randomBytes(48).toString("hex");
  const token_hash = hashToken(plain);
  const expires_at = new Date(Date.now() + ttlMs);
  await RefreshToken.create({ token_hash, user_id: userId, expires_at });
  return plain;
};

const consumeRefreshTokenAndRotate = async (plainRefresh) => {
  const token_hash = hashToken(plainRefresh);
  const existing = await RefreshToken.findOne({ token_hash });
  if (!existing || existing.expires_at < new Date()) {
    const err = new Error("Invalid or expired refresh token");
    err.statusCode = 401;
    throw err;
  }
  await RefreshToken.deleteOne({ _id: existing._id });
  const { User } = require("../models/user");
  const user = await User.findOne({ id: existing.user_id });
  if (!user) {
    const err = new Error("Invalid refresh token");
    err.statusCode = 401;
    throw err;
  }
  if (!user.is_active) {
    const err = new Error("Account is disabled");
    err.statusCode = 403;
    throw err;
  }
  const newPlain = await issueRefreshToken(user.id);
  const access_token = signAccessToken(user);
  return { access_token, refresh_token: newPlain, user };
};

const revokeRefreshToken = async (plainRefresh) => {
  if (!plainRefresh) return;
  const token_hash = hashToken(plainRefresh);
  await RefreshToken.deleteOne({ token_hash });
};

const revokeAllUserRefreshTokens = async (userId) => {
  await RefreshToken.deleteMany({ user_id: userId });
};

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  consumeRefreshTokenAndRotate,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  ACCESS_TTL_SEC,
  REFRESH_TTL_MS
};
