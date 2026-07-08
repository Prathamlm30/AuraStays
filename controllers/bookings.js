const Booking = require("../Models/Booking.js");
const Listing = require("../Models/Listing.js");

// 1. API Endpoint: Send booked dates to frontend calendar
module.exports.getBookedDates = async (req, res) => {
    try {
        const bookings = await Booking.find({ listing: req.params.id });
        const disabledDates = bookings.map(b => {
            return {
                from: b.checkIn.toISOString().split('T')[0],
                to: b.checkOut.toISOString().split('T')[0]
            };
        });
        res.json(disabledDates);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch dates" });
    }
};

// 2. Form Submission: Create a new trip
// 2. Form Submission: Create a new trip
module.exports.createBooking = async (req, res) => {
    try {
        const { checkIn, checkOut } = req.body;
        const listingId = req.params.id;

        // --- NEW SAFETY CHECK ---
        // If the user clicks reserve without selecting dates, stop and show an error
        if (!checkIn || !checkOut) {
            req.flash("error", "Select the dates first before booking and proceeding further.");
            return res.redirect(`/listings/${listingId}`);
        }
        // ------------------------
        
        const listing = await Listing.findById(listingId);
        
        // Calculate exact total price based on selected nights
        const d1 = new Date(checkIn);
        const d2 = new Date(checkOut);
        const diffDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
        
        // Safely extract the dynamic price and convert it to a Number
        let bookedPrice = listing.price; // Default to the normal price
        if (req.body.booking && req.body.booking.priceAtBooking) {
            bookedPrice = Number(req.body.booking.priceAtBooking);
        }
        
        let totalPrice = bookedPrice * diffDays;
        
        const booking = new Booking({
            listing: listingId,
            user: req.user._id,
            checkIn: d1,
            checkOut: d2,
            totalPrice
        });
        
        await booking.save();
        req.flash("success", "Trip booked successfully! Pack your bags!");
        res.redirect("/trips");
    } catch (err) {
        console.error("Booking Error:", err);
        req.flash("error", "Something went wrong while booking.");
        res.redirect(`/listings/${req.params.id}`);
    }
};

// 3. Render the My Trips Dashboard
module.exports.renderTrips = async (req, res) => {
    // Fetch all bookings for the logged-in user, and grab the listing data for the UI
    const trips = await Booking.find({ user: req.user._id })
                               .populate("listing")
                               .sort({ checkIn: 1 }); // Sort by upcoming
    res.render("users/trips.ejs", { trips });
};

// 4. Cancel a Booking
module.exports.destroyBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);
        
        // Security check: Ensure the logged-in user owns this trip
        if (!booking.user.equals(req.user._id)) {
            req.flash("error", "You don't have permission to cancel this trip.");
            return res.redirect("/trips");
        }
        
        await Booking.findByIdAndDelete(id);
        req.flash("success", "Reservation cancelled successfully. We hope you travel with us again!");
        res.redirect("/trips");
    } catch (err) {
        console.error("Cancellation Error:", err);
        req.flash("error", "Could not cancel the reservation.");
        res.redirect("/trips");
    }
};