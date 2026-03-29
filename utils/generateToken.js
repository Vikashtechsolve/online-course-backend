const jwt = require("jsonwebtoken");

function generateToken(userId, expiresIn) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: expiresIn || process.env.JWT_EXPIRE,
  });
}

function generateResetToken(userId) {
  return jwt.sign({ id: userId, purpose: "reset" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_RESET_EXPIRE || "15m",
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { generateToken, generateResetToken, verifyToken };
