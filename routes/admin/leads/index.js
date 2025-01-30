const express = require("express");
const router = express.Router();

const statusRouter = require("./status");
const sourceRouter = require("./source");
const labelRouter = require("./label");
const taskStatusRouter = require("./taskStatus");
const taskLabelRouter = require("./taskLabel");
const leadRouter = require("./lead");

router.use("/status", statusRouter);
router.use("/source", sourceRouter);
router.use("/label", labelRouter);
router.use("/task-status", taskStatusRouter);
router.use("/task-label", taskLabelRouter);
router.use("/lead", leadRouter);


module.exports = router;
