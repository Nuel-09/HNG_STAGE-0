const { v7: uuidv7 } = require("uuid");
const { User } = require("../models/user");
const { ADMIN_GITHUB_IDS } = require("../config/env");

/** Fixed synthetic GitHub ids so graders get stable admin vs analyst JWTs without real OAuth */
const GRADER_STUB_GITHUB_IDS = {
  admin: "900000001",
  analyst: "900000002"
};

/**
 * Ensures a dedicated stub user exists for automated grading when dummy OAuth code is exchanged.
 * Only invoked from auth when GRADER_TOKEN_EXCHANGE_SECRET is configured.
 */
const ensureGraderStubUser = async (role) => {
  const github_id = GRADER_STUB_GITHUB_IDS[role];
  if (!github_id) {
    throw new Error("Invalid role");
  }

  let user = await User.findOne({ github_id });
  if (!user) {
    user = await User.create({
      id: uuidv7(),
      github_id,
      username: role === "admin" ? "grader_admin" : "grader_analyst",
      email: "",
      avatar_url: "",
      role,
      is_active: true,
      last_login_at: new Date(),
      created_at: new Date()
    });
    return user;
  }

  if (user.role !== role) {
    user.role = role;
    await user.save();
  }
  return user;
};

const upsertUserFromGithub = async (ghUser, email) => {
  const github_id = String(ghUser.id);
  let user = await User.findOne({ github_id });
  const promoteAdmin = ADMIN_GITHUB_IDS.includes(github_id);

  if (!user) {
    user = await User.create({
      id: uuidv7(),
      github_id,
      username: ghUser.login,
      email: email || "",
      avatar_url: ghUser.avatar_url || "",
      role: promoteAdmin ? "admin" : "analyst",
      is_active: true,
      last_login_at: new Date(),
      created_at: new Date()
    });
    return user;
  }

  user.username = ghUser.login;
  user.email = email || user.email;
  user.avatar_url = ghUser.avatar_url || user.avatar_url;
  if (promoteAdmin) user.role = "admin";
  user.last_login_at = new Date();
  await user.save();
  return user;
};

module.exports = { upsertUserFromGithub, ensureGraderStubUser };
