const User = require("../Models/user.js");
const sendEmail = require("../utils/email"); 
const Booking = require("../Models/Booking.js");
const Listing = require("../Models/Listing.js"); 

const geoip = require("geoip-lite");
const SecurityLog = require("../Models/SecurityLog.js");

const crypto = require("crypto"); 
const sendSecurityEmail = require("../utils/sendEmail");
const { calculateDistance } = require("../utils/geoMath");

module.exports.renderSignupForm = (req,res) => {
    res.render("users/signup.ejs");
};

// 1. Intercept Signup & Send OTP
module.exports.signup = async (req, res, next) => {
    try {
        let { username, email, password } = req.body;
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        req.session.pendingUser = { username, email, password, otp };
        
        const subject = "Welcome to AuraStays!";
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                <h2>Welcome to AuraStays!</h2>
                <p>Your 6-digit verification code is:</p>
                <h1 style="color: #fe424d; letter-spacing: 5px;">${otp}</h1>
                <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
        `;

        await sendEmail(email, subject, htmlContent);
        
        req.flash("success", "Verification code sent! Please check your email.");
        res.redirect("/verify-otp");

    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

// 2. Render the OTP Page (Updated for dynamic EJS)
module.exports.renderOtpForm = (req, res) => {
    if (!req.session.pendingUser) {
        req.flash("error", "Your session expired. Please sign up again.");
        return res.redirect("/signup");
    }
    res.render("users/verify-otp.ejs", {
        actionUrl: "/verify-otp",
        buttonText: "Verify & Create Account"
    });
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

        if (otp === pendingUser.otp) {
            const newUser = new User({ email: pendingUser.email, username: pendingUser.username });
            const registeredUser = await User.register(newUser, pendingUser.password);
            
            req.login(registeredUser, (err) => {
                if (err) return next(err);
                
                delete req.session.pendingUser;
                
                req.flash("success", "Welcome to AuraStays! Account verified successfully.");
                res.redirect("/listings");
            });
        } else {
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

// --- IMPOSSIBLE TRAVEL: Login Controller ---
module.exports.login = async (req, res) => {
    let ip = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
    if (ip && ip.includes(',')) { ip = ip.split(',')[0].trim(); }

    const geo = geoip.lookup(ip);
    const city = geo ? geo.city : "Unknown";
    const country = geo ? geo.country : "Unknown";
    const lat = geo ? geo.ll[0] : null;
    const lon = geo ? geo.ll[1] : null;

    try {
        if (lat && lon) {
            const lastLog = await SecurityLog.findOne({ user: req.user._id }).sort({ createdAt: -1 });

            if (lastLog && lastLog.latitude && lastLog.longitude) {
                const distance = calculateDistance(lastLog.latitude, lastLog.longitude, lat, lon);
                const timeDiffHours = (Date.now() - lastLog.createdAt) / (1000 * 60 * 60);
                
                const travelSpeed = distance / (timeDiffHours || 0.01); 

                if (travelSpeed > 900) {
                    console.log(`[SECURITY ALERT] Impossible Travel Detected: ${travelSpeed.toFixed(2)} km/h`);
                    
                    const otp = crypto.randomInt(100000, 999999).toString();
                    
                    req.user.otp = otp;
                    req.user.otpExpires = Date.now() + 10 * 60 * 1000;
                    await req.user.save();

                    await sendSecurityEmail({
                        email: req.user.email,
                        subject: "AuraStays Security: Suspicious Login Detected",
                        message: `
                            <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                                <h2 style="color: #fe424d;">Security Alert</h2>
                                <p>We detected a login from <strong>${city}, ${country}</strong> that doesn't match your recent travel history.</p>
                                <p>If this was you, please enter the following code to verify your identity:</p>
                                <h1 style="background: #f4f4f4; padding: 15px; letter-spacing: 5px; text-align: center;">${otp}</h1>
                                <p style="color: #888; font-size: 12px;">This code expires in 10 minutes. If you did not initiate this login, please change your password immediately.</p>
                            </div>
                        `
                    });

                    // Redirect to the newly engineered Soft Block route
                    return res.redirect("/verify-security-otp"); 
                }
            }
        }

        const newLog = new SecurityLog({
            user: req.user._id,
            ipAddress: ip,
            city,
            country,
            latitude: lat,
            longitude: lon
        });
        await newLog.save();

    } catch (err) {
        console.error("Security Engine Error:", err);
    }
    
    req.flash("success", "Welcome back to AuraStays!");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
};

// ==========================================
// NEW: IMPOSSIBLE TRAVEL SECURITY CONTROLLERS
// ==========================================

module.exports.renderSecurityVerify = (req, res) => {
    res.render("users/verify-otp.ejs", { 
        actionUrl: "/verify-security-otp",
        buttonText: "Verify Login" 
    });
};

module.exports.verifySecurityOtp = async (req, res, next) => {
    try {
        const { otp } = req.body;
        const user = req.user; 

        if (!user.otp || user.otp !== otp) {
            req.flash("error", "Invalid or incorrect verification code.");
            return res.redirect("/verify-security-otp");
        }

        if (user.otpExpires < Date.now()) {
            user.otp = null;
            user.otpExpires = null;
            await user.save();
            
            req.logout((err) => {
                if (err) return next(err);
                req.flash("error", "Your verification code expired. Please log in again.");
                return res.redirect("/login");
            });
            return;
        }

        user.otp = null;
        user.otpExpires = null;
        await user.save();

        req.flash("success", "Identity verified! Welcome back to AuraStays.");
        
        let redirectUrl = res.locals.redirectUrl || "/listings";
        res.redirect(redirectUrl);
    } catch (err) {
        console.error("Security Verification Error:", err);
        req.flash("error", "Something went wrong.");
        res.redirect("/login");
    }
};

// ==========================================

module.exports.logout = (req,res,next) => {
    req.logout((err) => {
        if(err) {
            return next(err);
        }
        req.flash("success","you are logged out!");
        res.redirect("/listings");
    });
};

module.exports.renderProfile = async (req, res) => {
    try {
        const tripCount = await Booking.countDocuments({ user: req.user._id });
        
        const userListings = await Listing.find({ owner: req.user._id });
        const listingIds = userListings.map(listing => listing._id);
        
        const hostBookings = await Booking.find({ listing: { $in: listingIds } });
        
        let totalEarnings = 0;
        for (let booking of hostBookings) {
            totalEarnings += booking.totalPrice || 0; 
        }

        res.render("users/profile.ejs", { tripCount, totalEarnings });
        
    } catch (err) {
        console.error("Profile Error:", err);
        req.flash("error", "Could not load profile data.");
        res.redirect("/listings");
    }
};

module.exports.renderTrips = async (req, res) => {
    res.render("users/trips.ejs");
};

module.exports.renderWishlists = async (req, res) => {
    const user = await User.findById(req.user._id).populate("wishlists");
    res.render("users/wishlists.ejs", { allListings: user.wishlists });
};

module.exports.toggleWishlist = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);

    if (user.wishlists.includes(id)) {
        user.wishlists.pull(id);
        req.flash("success", "Removed from Wishlists");
    } else {
        user.wishlists.push(id);
        req.flash("success", "Saved to Wishlists");
    }
    
    await user.save();
    res.redirect(req.get("referer") || "/listings");
};

module.exports.renderPayoutSettings = (req, res) => {
    res.render("users/payout.ejs");
};

module.exports.initiatePayoutUpdate = async (req, res) => {
    const { accountName, accountNumber, ifscCode } = req.body;

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    req.session.pendingAction = {
        actionType: "UPDATE_PAYOUT",
        newPayoutData: { accountName, accountNumber, ifscCode },
        otp: otpCode,
        expiresAt: Date.now() + 10 * 60 * 1000
    };

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

module.exports.renderVerifyAction = (req, res) => {
    if (!req.session.pendingAction) {
        req.flash("error", "No pending action found.");
        return res.redirect("/listings");
    }
    
    res.render("users/verify-action.ejs", { email: req.user.email });
};

module.exports.verifyActionExecution = async (req, res) => {
    try {
        const pending = req.session.pendingAction;
        const { otpCode } = req.body;

        if (!pending || Date.now() > pending.expiresAt) {
            req.session.pendingAction = null; 
            req.flash("error", "The verification code has expired. Please try again.");
            return res.redirect("/listings");
        }

        if (otpCode !== pending.otp) {
            req.flash("error", "Invalid verification code. Please check your email and try again.");
            return res.redirect("/verify-action");
        }

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