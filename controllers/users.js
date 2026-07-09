const User = require("../Models/user.js");
// 1. UPDATED IMPORT: Change sendOTP to sendEmail
const sendEmail = require("../utils/email"); 
const Booking = require("../Models/Booking.js");
const Listing = require("../Models/Listing.js"); // Required for 2FA deletion

module.exports.renderSignupForm = (req,res) => {
    res.render("users/signup.ejs");
};

// 1. Intercept Signup & Send OTP
module.exports.signup = async (req, res, next) => {
    try {
        let { username, email, password } = req.body;
        
        // Generate a random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save the user's data AND the OTP temporarily in the session
        req.session.pendingUser = { username, email, password, otp };
        
        // --- 2. UPDATED EMAIL LOGIC: Dynamic Subject and HTML ---
        const subject = "Welcome to AuraStays!";
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                <h2>Welcome to AuraStays!</h2>
                <p>Your 6-digit verification code is:</p>
                <h1 style="color: #fe424d; letter-spacing: 5px;">${otp}</h1>
                <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
        `;

        // Send the email using the generic function
        await sendEmail(email, subject, htmlContent);
        // --------------------------------------------------------
        
        req.flash("success", "Verification code sent! Please check your email.");
        res.redirect("/verify-otp");

    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

// 2. Render the OTP Page
module.exports.renderOtpForm = (req, res) => {
    if (!req.session.pendingUser) {
        req.flash("error", "Your session expired. Please sign up again.");
        return res.redirect("/signup");
    }
    res.render("users/verify-otp.ejs");
};

// 3. Verify the OTP & Finally Save to Database
module.exports.verifyOtp = async (req, res, next) => {
    try {
        const { otp } = req.body;
        const pendingUser = req.session.pendingUser;

        if (!pendingUser) {
            req.flash("error", "Session expired. Please try signing up again.");
            return res.redirect("/signup");
        }

        // Check if the code matches!
        if (otp === pendingUser.otp) {
            // Success! Now we actually save them to the database
            const newUser = new User({ email: pendingUser.email, username: pendingUser.username });
            const registeredUser = await User.register(newUser, pendingUser.password);
            
            // Log them in automatically
            req.login(registeredUser, (err) => {
                if (err) return next(err);
                
                // Clear the temporary session data
                delete req.session.pendingUser;
                
                req.flash("success", "Welcome to AuraStays! Account verified successfully.");
                res.redirect("/listings");
            });
        } else {
            // Failure! Code didn't match
            req.flash("error", "Invalid verification code. Please try again.");
            res.redirect("/verify-otp");
        }
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

module.exports.renderLoginForm = (req,res) => {
    res.render("users/login.ejs");
};

module.exports.login = async(req,res) => {
    req.flash("success","Welcome back to AuraStays!");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
};

module.exports.logout = (req,res,next) => {
    req.logout((err) => {
        if(err) {
            return next(err);
        }
        req.flash("success","you are logged out!");
        res.redirect("/listings");
    });
};

// 1. Render Profile Page
module.exports.renderProfile = async (req, res) => {
    try {
        // Ask the database: "How many bookings match this user's ID?"
        const tripCount = await Booking.countDocuments({ user: req.user._id });
        
        // Pass that count to the EJS template
        res.render("users/profile.ejs", { tripCount });
    } catch (err) {
        console.error(err);
        req.flash("error", "Could not load profile data.");
        res.redirect("/listings");
    }
};

// 2. Render Trips Page (Placeholder for future Stripe integration)
module.exports.renderTrips = async (req, res) => {
    res.render("users/trips.ejs");
};

// 3. Render Wishlists Page
module.exports.renderWishlists = async (req, res) => {
    // Fetch the user and populate the actual listing data from the ObjectIds
    const user = await User.findById(req.user._id).populate("wishlists");
    res.render("users/wishlists.ejs", { allListings: user.wishlists });
};

// 4. Toggle Wishlist Logic (Add/Remove)
module.exports.toggleWishlist = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);

    // Check if the listing is already in their wishlist array
    if (user.wishlists.includes(id)) {
        // If yes, remove it
        user.wishlists.pull(id);
        req.flash("success", "Removed from Wishlists");
    } else {
        // If no, add it
        user.wishlists.push(id);
        req.flash("success", "Saved to Wishlists");
    }
    
    await user.save();
    
    // Smart redirect: send them exactly back to the page they clicked the button on
    res.redirect(req.get("referer") || "/listings");
};

// ==========================================
// 2FA SECURITY CONTROLLERS
// ==========================================

// 1. Render the 2FA Verification Page
module.exports.renderVerifyAction = (req, res) => {
    // Prevent users from accessing this page directly if they haven't initiated an action
    if (!req.session.pendingAction) {
        req.flash("error", "No pending action found.");
        return res.redirect("/listings");
    }
    
    // Pass the email to the frontend so we can show them where we sent it
    res.render("users/verify-action.ejs", { email: req.user.email });
};

// 2. Handle the 2FA Verification and Execute Action
module.exports.verifyActionExecution = async (req, res) => {
    try {
        const pending = req.session.pendingAction;
        const { otpCode } = req.body;

        // Check if the session expired or is missing
        if (!pending || Date.now() > pending.expiresAt) {
            req.session.pendingAction = null; 
            req.flash("error", "The verification code has expired. Please try again.");
            return res.redirect("/listings");
        }

        // Validate the OTP
        if (otpCode !== pending.otp) {
            req.flash("error", "Invalid verification code. Please check your email and try again.");
            return res.redirect("/verify-action");
        }

        // OTP is Valid! Execute the requested action dynamically
        if (pending.actionType === "DELETE_LISTING") {
            await Listing.findByIdAndDelete(pending.listingId);
            req.session.pendingAction = null; 
            
            req.flash("success", "Listing successfully and securely deleted.");
            return res.redirect("/listings");
        } 
        else {
            req.session.pendingAction = null;
            req.flash("error", "Unknown action requested.");
            return res.redirect("/listings");
        }

    } catch (err) {
        console.error("2FA Execution Error:", err);
        req.session.pendingAction = null;
        req.flash("error", "Something went wrong while verifying your action.");
        res.redirect("/listings");
    }
};