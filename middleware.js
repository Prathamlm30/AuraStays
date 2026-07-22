const Listing = require("./Models/Listing.js");
const Review = require("./Models/review.js");
const ExpressError = require("./utils/ExpressError.js");
const {listingSchema, reviewSchema} = require("./schema.js");

const rateLimit = require("express-rate-limit");

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        
        if (req.originalUrl.includes("/bookings")) {
            req.flash("error", "You need to be logged in in order to create/book a reservation.");
        } else if (req.originalUrl.includes("/reviews")) {
            req.flash("error", "You need to be logged in to leave a review.");
        } else {
            req.flash("error", "You must be logged in to create a listing!");
        }
        
        // FIX: Force MongoDB to save the flash message BEFORE redirecting
        return req.session.save(() => {
            res.redirect("/login");
        });
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
        return req.session.save(() => {
            res.redirect(`/listings/${id}`);
        });
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
        return req.session.save(() => {
            res.redirect(`/listings/${id}`);
        });
    }
    next();
};

module.exports.isAdmin = (req, res, next) => {
    if (!req.user) {
        req.flash("error", "You must be logged in to do that.");
        return req.session.save(() => {
            res.redirect("/login");
        });
    }
    
    if (req.user.role !== 'admin') {
        req.flash("error", "Access Denied: You do not have permission to access the Command Center.");
        return req.session.save(() => {
            res.redirect("/listings");
        });
    }
    
    next();
};

// THREAT DEFENSE: BRUTE FORCE LIMITER
module.exports.loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5, 
    handler: (req, res, next, options) => {
        req.flash("error", "Security Alert: Too many failed login attempts. Your IP has been temporarily blocked for 15 minutes.");
        req.session.save(() => {
            res.redirect("/login");
        });
    }
});