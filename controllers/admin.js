const User = require("../Models/user.js");
const Listing = require("../Models/Listing.js");
const Booking = require("../Models/Booking.js");

const SecurityLog = require("../Models/SecurityLog.js");

module.exports.renderDashboard = async (req, res) => {
    try {
        // 1. Fetch Platform-Wide Metrics
        const totalUsers = await User.countDocuments();
        const totalListings = await Listing.countDocuments();
        const totalBookings = await Booking.countDocuments();

        // 2. Fetch the User Roster (Latest 20 users)
        let users = await User.find({})
            .populate('totalListings') 
            .populate('totalReviews')  
            .sort({ _id: -1 }) 
            .limit(20);
        
        // Pin Admin(s) to the very top using JavaScript
        users.sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin') return -1;
            if (a.role !== 'admin' && b.role === 'admin') return 1;
            return 0;
        });

        // --- NEW: 3. Fetch Recent Security Logs ---
        const recentLogs = await SecurityLog.find({})
            .populate("user") // Grabs the actual user data, not just the ID
            .sort({ createdAt: -1 }) // Newest events first
            .limit(10); // Show the last 10 logins

        // 4. Render the secure dashboard (Passing recentLogs!)
        res.render("admin/dashboard.ejs", {
            totalUsers,
            totalListings,
            totalBookings,
            users,
            recentLogs // <-- Added here
        });
    } catch (err) {
        console.error("Command Center Error:", err);
        req.flash("error", "Could not load the Security Command Center.");
        res.redirect("/listings");
    }
};

// Suspend (Delete) a User
module.exports.suspendUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Find the user
        const userToSuspend = await User.findById(id);
        
        // 2. Security Check: Never let an admin delete another admin!
        if (userToSuspend.role === 'admin') {
            req.flash("error", "Security alert: You cannot suspend an Admin account.");
            return res.redirect("/admin/dashboard");
        }

        // 3. Delete the user
        await User.findByIdAndDelete(id);
        
        // 4. Flash success and reload the dashboard
        req.flash("success", `User ${userToSuspend.username} has been permanently suspended.`);
        res.redirect("/admin/dashboard");

    } catch (err) {
        console.error("Suspend User Error:", err);
        req.flash("error", "Something went wrong while trying to suspend the user.");
        res.redirect("/admin/dashboard");
    }
};