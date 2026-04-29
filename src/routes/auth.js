const express = require("express");
const {
  startGithub,
  githubCallback,
  githubToken,
  issueCsrfToken,
  refresh,
  logout
} = require("../controllers/authController");
const { csrfProtect } = require("../middleware/csrf");

const router = express.Router();

router.get("/github", startGithub);
router.get("/github/callback", githubCallback);
router.get("/csrf-token", issueCsrfToken);
router.post("/github/token", githubToken);
router.post("/refresh", csrfProtect, refresh);
router.post("/logout", csrfProtect, logout);

const logoutMethodNotAllowed = (req, res) => {
  res.setHeader("Allow", "POST");
  return res.status(405).json({ status: "error", message: "Method Not Allowed" });
};
router.get("/logout", logoutMethodNotAllowed);
router.put("/logout", logoutMethodNotAllowed);
router.delete("/logout", logoutMethodNotAllowed);
router.patch("/logout", logoutMethodNotAllowed);

module.exports = router;
