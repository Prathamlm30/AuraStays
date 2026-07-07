const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../Models/Listing.js");
const {isLoggedIn, isOwner, validateListing} = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const {storage} = require("../cloudConfig.js");
const upload = multer({storage});

const bookingController = require("../controllers/bookings.js");

router.route("/")
    //index route
    .get(wrapAsync(listingController.index))
    //create route
    .post(isLoggedIn,validateListing,upload.single("listing[image]"), wrapAsync(listingController.createListing));

//new route
router.get("/new",isLoggedIn, listingController.renderNewForm);

// ai insights route...
router.get("/:id/ai-summary", wrapAsync(listingController.getAISummary));

// NEW: Consumer AI Trip Planner Route
router.get("/:id/ai-itinerary", wrapAsync(listingController.getAITripItinerary));

// NEW: AI Natural Language Search Route
// MUST GO ABOVE router.route("/:id")
router.get("/search", wrapAsync(listingController.searchListings));

// Fetch booked dates for Flatpickr
router.get("/:id/booked-dates", wrapAsync(bookingController.getBookedDates));

// Submit a reservation
router.post("/:id/bookings", isLoggedIn, wrapAsync(bookingController.createBooking));

router.route("/:id")
    //show route
    .get(wrapAsync( listingController.showListing))
    //update route
    .put(isLoggedIn,isOwner,upload.single("listing[image]"),validateListing, wrapAsync( listingController.updateListing))
    //delete route
    .delete(isLoggedIn,isOwner,wrapAsync( listingController.destroyListing));

    
//edit route
router.get("/:id/edit",isLoggedIn,isOwner,wrapAsync( listingController.renderEditForm));

module.exports = router;