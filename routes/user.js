const express = require("express");
const router = express.Router();
const User = require("../Models/user.js");
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const { saveRedirectUrl, isLoggedIn} = require("../middleware.js");
const userController = require("../controllers/users.js");
const bookingController = require("../controllers/bookings.js");

// ==========================================
// 1. LOCAL AUTHENTICATION ROUTES
// ==========================================
router.route("/signup")
    .get(userController.renderSignupForm)
    .post(wrapAsync(userController.signup));

router.route("/login")
    .get(userController.renderLoginForm)
    .post(saveRedirectUrl, passport.authenticate("local", {failureRedirect: "/login", failureFlash: true}), userController.login);


// Add these right below your router.route("/login") block:
router.route("/verify-otp")
    .get(userController.renderOtpForm)
    .post(wrapAsync(userController.verifyOtp));


router.get("/logout", userController.logout);

// ==========================================
// 2. GOOGLE OAUTH 2.0 ROUTES
// ==========================================

// Trigger the Google Authentication consent screen
router.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

// The Callback Route (Google sends the user here after verification)
router.get("/auth/google/callback", 
    passport.authenticate("google", { 
        failureRedirect: "/login", 
        failureFlash: true 
    }),
    (req, res) => {
        // If successful, flash a welcome message
        req.flash("success", "Welcome to AuraStays! Successfully logged in with Google.");
        
        // Smart Redirect: Send them back to where they were trying to go, or default to listings
        let redirectUrl = res.locals.redirectUrl || "/listings";
        res.redirect(redirectUrl);
    }
);

// ==========================================
// 3. PROFILE, TRIPS, & WISHLIST ROUTES
// ==========================================
router.get("/profile", isLoggedIn, userController.renderProfile);
router.get("/wishlists", isLoggedIn, userController.renderWishlists);
router.post("/listings/:id/wishlist", isLoggedIn, wrapAsync(userController.toggleWishlist));

router.get("/trips", isLoggedIn, wrapAsync(bookingController.renderTrips));

module.exports = router;