const express = require("express");
const router = express.Router();
const User = require("../Models/user.js");
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const { saveRedirectUrl, isLoggedIn, loginLimiter} = require("../middleware.js");
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
    // FIX: Intercept Passport to force a session save on failed login
    .post(saveRedirectUrl, loginLimiter, (req, res, next) => {
        passport.authenticate("local", (err, user, info) => {
            if (err) return next(err);
            if (!user) {
                // Flash the error and WAIT for it to save
                req.flash("error", info.message || "Invalid username or password.");
                return req.session.save(() => {
                    res.redirect("/login");
                });
            }
            req.logIn(user, (err) => {
                if (err) return next(err);
                next(); // Proceed to userController.login on success
            });
        })(req, res, next);
    }, userController.login);

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
// NEW: Delete a reservation
router.delete("/bookings/:id", isLoggedIn, wrapAsync(bookingController.destroyBooking));

// ==========================================
// PAYOUT ROUTES
// ==========================================
router.route("/payout")
    .get(isLoggedIn, userController.renderPayoutSettings)
    .post(isLoggedIn, wrapAsync(userController.initiatePayoutUpdate));

// ==========================================
// 4. 2FA SECURITY ROUTES
// ==========================================

// Render the 2FA Verification Page
router.get("/verify-action", isLoggedIn, userController.renderVerifyAction);

// Handle the 2FA Verification and Execute Action
router.post("/verify-action", isLoggedIn, wrapAsync(userController.verifyActionExecution));

module.exports = router;