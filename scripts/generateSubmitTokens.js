const mongoose = require("mongoose");
const { MONGODB_URI, TEST_ACCESS_TOKEN_TTL_SEC, TEST_REFRESH_TOKEN_TTL_SEC } = require("../src/config/env");
const { ensureGraderStubUser } = require("../src/services/userService");
const { signAccessToken, issueRefreshToken } = require("../src/services/tokenService");

const role = process.argv[2] || "analyst";
if (!["admin", "analyst"].includes(role)) {
  console.error("Usage: node scripts/generateSubmitTokens.js [admin|analyst]");
  process.exit(1);
}

const run = async () => {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }
  await mongoose.connect(MONGODB_URI);
  const user = await ensureGraderStubUser(role);
  const access_token = signAccessToken(user, TEST_ACCESS_TOKEN_TTL_SEC);
  const refresh_token = await issueRefreshToken(user.id, TEST_REFRESH_TOKEN_TTL_SEC * 1000);

  console.log(
    JSON.stringify(
      {
        status: "success",
        role,
        access_token,
        refresh_token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
