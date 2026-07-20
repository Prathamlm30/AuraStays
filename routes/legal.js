const express = require("express");
const router = express.Router();

// Render Terms & Conditions
router.get("/terms", (req, res) => {
    res.render("legal/terms.ejs");
});

// Render Privacy Policy
router.get("/privacy", (req, res) => {
    res.render("legal/privacy.ejs");
});

// Render Content Policy
router.get("/content-policy", (req, res) => {
    res.render("legal/content-policy.ejs");
});

module.exports = router;