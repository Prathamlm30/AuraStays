const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.js");
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isAdmin } = require("../middleware.js"); // Importing your custom bouncer

// ==========================================
// SECURITY COMMAND CENTER ROUTES
// ==========================================

// The main dashboard route (Protected by isLoggedIn AND isAdmin)
router.get("/dashboard", isLoggedIn, isAdmin, wrapAsync(adminController.renderDashboard));

// Suspend a User Route
router.delete("/users/:id/suspend", isLoggedIn, isAdmin, wrapAsync(adminController.suspendUser));

module.exports = router;