const express = require("express");
const protect = require("../middleware/auth");
const { updateSubmission } = require("../controllers/assignmentController");

const router = express.Router();

router.put("/:id", protect, updateSubmission);

module.exports = router;
