const express = require("express");
const router = express.Router({mergeParams: true});
const wrapAsync = require("../utils/wrapAsync.js");
const Review = require("../Models/review.js");
const Listing = require("../Models/Listing.js");

// IMPORT ALL NEEDED MIDDLEWARE HERE
const {validateReview, isLoggedIn, isReviewAuthor, isOwner} = require("../middleware.js");
const reviewController = require("../controllers/reviews.js");

// post review route
router.post("/", isLoggedIn, validateReview, wrapAsync(reviewController.createReview));

// NEW: AI Host Reply Route (Protected)
router.get(
    "/:reviewId/ai-reply", 
    isLoggedIn, // 1. Must be logged in
    isOwner,    // 2. Must be the owner of the listing
    wrapAsync(reviewController.generateAIReply) // 3. Generate the reply
);

router.post(
    "/:reviewId/reply",
    isLoggedIn, // Must be logged in
    isOwner,    // Must be the owner of the listing
    wrapAsync(reviewController.createReply)
);

router.delete(
    "/:reviewId/reply",
    isLoggedIn, // Must be logged in
    isOwner,    // Must be the owner of the listing
    wrapAsync(reviewController.deleteReply)
);

// delete review route
router.delete("/:reviewId", isLoggedIn, isReviewAuthor, wrapAsync(reviewController.destroyReview));

module.exports = router;