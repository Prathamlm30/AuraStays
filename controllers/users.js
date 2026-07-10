const User = require("../Models/user.js");
// 1. UPDATED IMPORT: Change sendOTP to sendEmail
const sendEmail = require("../utils/email"); 
const Booking = require("../Models/Booking.js");
const Listing = require("../Models/Listing.js"); // Required for 2FA deletion

const geoip = require("geoip-lite");
const SecurityLog = require("../Models/SecurityLog.js");

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

module.exports.login = async (req, res) => {
    // --- 1. THREAT DETECTION: Geographic Logging ---
    // Grab the IP address from the incoming request
    let ip = req.ip || req.connection.remoteAddress;

    // 🚨 LOCALHOST TESTING CHEAT: 
    // Uncomment the line below to simulate a login from London, UK.
    // Make sure to delete or re-comment this line before you push to production!
   // ip = "207.97.227.239"; 

    // Translate the IP to a physical location
    const geo = geoip.lookup(ip);
    const city = geo ? geo.city : "Unknown";
    const country = geo ? geo.country : "Unknown";

    try {
        // Save the log to the database silently
        const newLog = new SecurityLog({
            user: req.user._id,
            ipAddress: ip,
            city: city,
            country: country
        });
        await newLog.save();
    } catch (err) {
        console.error("Security Logging Error:", err);
    }
    // -----------------------------------------------

    // --- 2. Normal Login Execution ---
    req.flash("success", "Welcome back to AuraStays!");
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
        // --- 1. GUEST STATS ---
        // How many trips has this user booked?
        const tripCount = await Booking.countDocuments({ user: req.user._id });
        
        // --- 2. HOST STATS (Total Earnings) ---
        // First, find all properties owned by this user
        const userListings = await Listing.find({ owner: req.user._id });
        const listingIds = userListings.map(listing => listing._id);
        
        // Next, find every single booking made at any of those properties
        const hostBookings = await Booking.find({ listing: { $in: listingIds } });
        
        // Finally, loop through those bookings and sum up the total revenue
        let totalEarnings = 0;
        for (let booking of hostBookings) {
            // Fallback to 0 if totalPrice is ever missing to prevent NaN errors
            totalEarnings += booking.totalPrice || 0; 
        }

        // Pass both stats to the EJS template
        res.render("users/profile.ejs", { tripCount, totalEarnings });
        
    } catch (err) {
        console.error("Profile Error:", err);
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

// Render the Payout Settings Page
module.exports.renderPayoutSettings = (req, res) => {
    res.render("users/payout.ejs");
};

// Intercept Payout Update & Trigger 2FA
module.exports.initiatePayoutUpdate = async (req, res) => {
    const { accountName, accountNumber, ifscCode } = req.body;

    // 1. Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Save the intent AND the new data in the session
    req.session.pendingAction = {
        actionType: "UPDATE_PAYOUT",
        newPayoutData: { accountName, accountNumber, ifscCode },
        otp: otpCode,
        expiresAt: Date.now() + 10 * 60 * 1000
    };

    // 3. Send the custom security email
    const subject = "Security Alert: Verify Payout Changes";
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
            <h2>Payout Details Update</h2>
            <p>We received a request to update your bank payout details. Use this code to confirm:</p>
            <h1 style="color: #fe424d; letter-spacing: 5px;">${otpCode}</h1>
            <p>If you did not request this, please secure your account immediately.</p>
        </div>
    `;

    try {
        await sendEmail(req.user.email, subject, htmlContent);
        req.flash("success", "Check your email for a verification code to confirm your new payout settings.");
        res.redirect("/verify-action");
    } catch (err) {
        console.error("Email Error:", err);
        req.flash("error", "Could not send verification email. Try again later.");
        res.redirect("/payout");
    }
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
        else if (pending.actionType === "UPDATE_PAYOUT") {
            const user = await User.findById(req.user._id);
            user.payoutDetails = pending.newPayoutData;
            await user.save();

            req.session.pendingAction = null;
            req.flash("success", "Payout settings securely updated!");
            return res.redirect("/profile");
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