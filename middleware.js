const Listing = require("./Models/Listing.js");
const Review = require("./Models/review.js");
const ExpressError = require("./utils/ExpressError.js");
const {listingSchema, reviewSchema} = require("./schema.js");

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
    let review = await Review.findById(reviewId);
    if(!review.author._id.equals(res.locals.currUser._id)) {
        req.flash("error","you are not the author of this review.");
        return res.redirect(`/listings/${id}`);
    }
    next();
};