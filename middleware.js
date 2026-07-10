const Listing = require("./Models/Listing.js");
const Review = require("./Models/review.js");
const ExpressError = require("./utils/ExpressError.js");
const {listingSchema, reviewSchema} = require("./schema.js");

const rateLimit = require("express-rate-limit");

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        // Save the URL they were trying to access
        req.session.redirectUrl = req.originalUrl;
        
        // --- DYNAMIC ERROR MESSAGES ---
        if (req.originalUrl.includes("/bookings")) {
            // If they were trying to reserve a property
            req.flash("error", "You need to be logged in in order to create/book a reservation.");
            
        } else if (req.originalUrl.includes("/reviews")) {
            // If they were trying to leave a review
            req.flash("error", "You need to be logged in to leave a review.");
            
        } else {
            // Default fallback for creating/editing a listing
            req.flash("error", "You must be logged in to create a listing!");
        }
        
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirectUrl = (req,res,next) => {
    if(req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

module.exports.isOwner = async(req,res,next) => {
    let {id} = req.params;
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    let listing = await Listing.findById(id);
    if(!listing.owner._id.equals(res.locals.currUser._id)) {
        req.flash("error","you are not the owner of this listing.");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.validateListing = (req,res,next) => {
    let {error} = listingSchema.validate(req.body);
    if(error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

module.exports.validateReview = (req,res,next) => {
    let {error} = reviewSchema.validate(req.body);
    if(error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

module.exports.isReviewAuthor = async(req,res,next) => {
    let {id, reviewId} = req.params;
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    let review = await Review.findById(reviewId);
    if(!review.author._id.equals(res.locals.currUser._id)) {
        req.flash("error","you are not the author of this review.");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.isAdmin = (req, res, next) => {
    // 1. Check if they are logged in at all
    if (!req.user) {
        req.flash("error", "You must be logged in to do that.");
        return res.redirect("/login");
    }
    
    // 2. Check if they have the admin role
    if (req.user.role !== 'admin') {
        req.flash("error", "Access Denied: You do not have permission to access the Command Center.");
        return res.redirect("/listings"); // Kick them back to the homepage
    }
    
    // 3. If they are an admin, let them through!
    next();
};

// THREAT DEFENSE: BRUTE FORCE LIMITER
// ==========================================
module.exports.loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes time window
    max: 5, // Limit each IP to 5 requests per window
    handler: (req, res, next, options) => {
        // What happens when they hit the limit:
        req.flash("error", "Security Alert: Too many failed login attempts. Your IP has been temporarily blocked for 15 minutes.");
        res.redirect("/login");
    }
});