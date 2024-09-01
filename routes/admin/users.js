var express = require("express");
var router = express.Router();

const usersController = require("../../controllers/users");

router.get('/users', async (req, res) => {
    try {
        const { page, pageSize } = req.query;
        const response = await usersController.getAllUsers(page, pageSize);
        res.status(200).json(response);
    } catch (error) {
        console.error("Error handling request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
