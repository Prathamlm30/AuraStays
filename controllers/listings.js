const Listing = require("../Models/Listing.js");
const Booking = require("../Models/Booking.js");

const sendEmail = require("../utils/email.js"); 

// 1. HOMEPAGE CONTROLLER (With Dynamic Pricing)
module.exports.index = async (req, res) => {
    try {
        const { q, category } = req.query;
        let dbQuery = {};

        if (q) {
            dbQuery = {
                $or: [
                    { location: { $regex: q, $options: 'i' } },
                    { country: { $regex: q, $options: 'i' } },
                    { title: { $regex: q, $options: 'i' } }
                ]
            };
        }

        if (category) {
            dbQuery.category = category;
        }

        const listings = await Listing.find(dbQuery);

        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        const allListings = await Promise.all(listings.map(async (listing) => {
            const upcomingBookings = await Booking.find({
                listing: listing._id,
                checkOut: { $gte: today },
                checkIn: { $lte: thirtyDaysFromNow }
            });

            let bookedDays = 0;
            for (let booking of upcomingBookings) {
                const start = booking.checkIn < today ? today : booking.checkIn;
                const end = booking.checkOut > thirtyDaysFromNow ? thirtyDaysFromNow : booking.checkOut;
                const timeDifference = end.getTime() - start.getTime();
                bookedDays += Math.ceil(timeDifference / (1000 * 3600 * 24));
            }

            if (bookedDays > 30) bookedDays = 30;
            const occupancyRate = bookedDays / 30;

            let dynamicPrice = listing.price;
            let surgeStatus = "normal";

            if (occupancyRate >= 0.7) {
                dynamicPrice = Math.round(listing.price * 1.15);
                surgeStatus = "high";
            } else if (occupancyRate <= 0.2) {
                dynamicPrice = Math.round(listing.price * 0.90);
                surgeStatus = "low";
            }

            return {
                ...listing.toObject(),
                dynamicPrice,
                surgeStatus
            };
        }));

        res.render("listings/index.ejs", { allListings, searchQuery: q });
    } catch (err) {
        console.error("Homepage Pricing Error:", err);
        res.redirect("/listings");
    }
};

// 2. RENDER NEW FORM
module.exports.renderNewForm = (req,res) => {
    res.render("listings/new.ejs");
};

// 3. SHOW LISTING (With Dynamic Pricing)
module.exports.showListing = async (req, res) => {
    try {
        let { id } = req.params;
        
        const listing = await Listing.findById(id)
            .populate({
                path: "reviews",
                populate: { path: "author" }
            })
            .populate("owner");

        if (!listing) {
            req.flash("error", "The listing you requested does not exist!");
            return res.redirect("/listings");
        }
        
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        const upcomingBookings = await Booking.find({
            listing: id,
            checkOut: { $gte: today },
            checkIn: { $lte: thirtyDaysFromNow }
        });

        let bookedDays = 0;
        for (let booking of upcomingBookings) {
            const start = booking.checkIn < today ? today : booking.checkIn;
            const end = booking.checkOut > thirtyDaysFromNow ? thirtyDaysFromNow : booking.checkOut;
            
            const timeDifference = end.getTime() - start.getTime();
            const days = Math.ceil(timeDifference / (1000 * 3600 * 24));
            bookedDays += days;
        }

        if (bookedDays > 30) bookedDays = 30;
        const occupancyRate = bookedDays / 30;

        let dynamicPrice = listing.price;
        let surgeStatus = "normal"; 

        if (occupancyRate >= 0.7) {
            dynamicPrice = Math.round(listing.price * 1.15);
            surgeStatus = "high";
        } else if (occupancyRate <= 0.2) {
            dynamicPrice = Math.round(listing.price * 0.90);
            surgeStatus = "low";
        }

        res.render("listings/show.ejs", { listing, dynamicPrice, surgeStatus });
        
    } catch (err) {
        console.error("Pricing Engine Error:", err);
        req.flash("error", "Could not load the listing.");
        res.redirect("/listings");
    }
};

// 4. CREATE LISTING
module.exports.createListing = async (req,res) => {
    const address = `${req.body.listing.location}, ${req.body.listing.country}`;
    
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`, {
        headers: {
            "User-Agent": "AuraStays/1.0" 
        }
    });
    
    const data = await response.json();

    let geometry = {
        type: "Point",
        coordinates: [77.2090, 28.6139] 
    };

    if (data && data.length > 0) {
        geometry.coordinates = [
            parseFloat(data[0].lon), 
            parseFloat(data[0].lat)
        ];
    }

    let url = req.file.path;
    let filename = req.file.filename;
    
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = {url, filename};
    newListing.geometry = geometry; 
    
    await newListing.save();
    
    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
};

// 5. RENDER EDIT FORM
module.exports.renderEditForm = async (req,res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id);
    if(!listing) {
        req.flash("error","Listing you requested for does not exist!");
        return res.redirect("/listings");
    }

    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload","/upload/w_250");
    res.render("listings/edit.ejs", {listing, originalImageUrl});
};

// 6. UPDATE LISTING
module.exports.updateListing = async(req,res) => {
    if(!req.body.listing) {
        throw new ExpressError(400, "send valid data for listing.");
    }
    
    let {id} = req.params;
    const address = `${req.body.listing.location}, ${req.body.listing.country}`;
    
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`, {
        headers: {
            "User-Agent": "AuraStays/1.0" 
        }
    });
    
    const data = await response.json();
    const updatedData = { ...req.body.listing };

    if (data && data.length > 0) {
        updatedData.geometry = {
            type: "Point",
            coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)]
        };
    }

    let listing = await Listing.findByIdAndUpdate(id, updatedData);

    if(typeof(req.file) !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        listing.image = {url, filename};
        await listing.save();
    }
    
    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
};

// 7. DESTROY LISTING
module.exports.destroyListing = async (req, res) => {
    let { id } = req.params;
    
    // 1. Generate a 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 2. Save to session
    req.session.pendingAction = {
        actionType: "DELETE_LISTING",
        listingId: id,
        otp: otpCode,
        expiresAt: Date.now() + 10 * 60 * 1000 
    };

    // 3. Send the custom security email
    const emailSubject = "Security Alert: Verify Listing Deletion";
    const emailBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
            <h2>Delete Property Confirmation</h2>
            <p>You have requested to delete a listing. Please use the following code to confirm:</p>
            <h1 style="color: #fe424d; letter-spacing: 5px;">${otpCode}</h1>
            <p>This code will expire in 10 minutes. If you did not request this, please change your account password immediately.</p>
        </div>
    `;

    try {
        await sendEmail(req.user.email, emailSubject, emailBody);
        req.flash("success", "For your security, we've sent a 6-digit code to your email to confirm this deletion.");
        res.redirect(`/verify-action`); 
    } catch (err) {
        console.error("Email error:", err);
        req.flash("error", "Failed to send security email.");
        res.redirect(`/listings/${id}`);
    }
}

// =======================
// AI INTEGRATION
// =======================
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports.getAISummary = async (req, res) => {
    try {
        let { id } = req.params;
        const listing = await Listing.findById(id).populate("reviews");

        if (!listing) {
            return res.status(404).json({ error: "Listing not found" });
        }

        const allReviews = listing.reviews.map(r => r.comment).join(" | ");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            You are an expert travel agent. Write a concise, 3-paragraph summary for an Airbnb listing. 
            Do not use markdown formatting like asterisks or hashtags. Keep it plain text.
            
            Listing Title: ${listing.title}
            Location: ${listing.location}, ${listing.country}
            Host Description: ${listing.description}
            Guest Reviews: ${allReviews || "No reviews yet."}

            Format your response exactly like this:
            About the Property: [Summarize the vibe and features of the house in 2 sentences]
            The Neighborhood: [Describe the location, ${listing.location}, and what makes it special in 2 sentences]
            Guest Sentiment: [Summarize what reviewers liked or disliked in 2 sentences. If no reviews, say "Be the first to leave a review!"]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ summary: text });

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to generate AI summary." });
    }
};


module.exports.getAITripItinerary = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: "Listing not found" });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            You are a highly knowledgeable local travel concierge. Create a 3-Day Travel Itinerary for a guest staying at an accommodation named "${listing.title}" located in ${listing.location}, ${listing.country}.
            
            Please generate the itinerary following these strict rules:
            1. Proximity: Center the activities practically around the accommodation's location. Include the absolute must-do attractions for this country/city.
            2. Dining: Recommend budget-friendly restaurants that DO NOT compromise on quality. Emphasize authentic local cuisine that offers the best value for money.
            3. The "Crucial Details" Factor: Add a section at the end titled "Local Secrets & Crucial Tips". Include things guests usually skip or forget (e.g., hidden gems, local cultural etiquette, navigating public transport, or safety/tourist trap warnings).
            
            Output Format:
            Return the response strictly in raw HTML format. Use <h4> for days, <ul> and <li> for lists, <strong> for emphasis, and <p> for descriptions. 
            CRITICAL: Do NOT wrap the response in markdown blocks (e.g., no \`\`\`html). Return only the raw HTML code.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        res.json({ itinerary: response.text() });
    } catch (error) {
        console.error("AI Itinerary Error:", error);
        res.status(500).json({ error: "Failed to generate itinerary." });
    }
};


module.exports.searchListings = async (req, res) => {
    try {
        const searchQuery = req.query.q; 
        
        if (!searchQuery) {
            return res.redirect("/listings");
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            You are an advanced semantic query parsing engine for a travel platform.
            The user has typed this natural language search request: "${searchQuery}"
            
            Analyze the request and break it down into the following structural elements:
            1. "location": A specific city, state, or country if explicitly named (otherwise "").
            2. "category": Map the request to exactly ONE of these specific database categories if it fits the vibe: "Trending", "Rooms", "Iconic Cities", "Mountains", "Castles", "Amazing Pools", "Camping", "Farms", "Arctic", "Domes", "Boats" (otherwise "").
            3. "tags": Generate an array of 3 to 5 generic, descriptive single-word keywords, synonyms, or features that capture the essence, target audience, or activity described in the query (e.g., for kids -> ["kids", "family", "fun", "playground", "children"]; for peace -> ["quiet", "peaceful", "nature", "calm"]). Keep them generic.
            
            Respond STRICTLY with a valid JSON object in this exact format, with no markdown formatting:
            {
                "location": "",
                "category": "",
                "tags": []
            }
        `;

        const result = await model.generateContent(prompt);
        let responseText = await result.response.text();
        
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Invalid response format from semantic engine.");
        }
        
        const aiData = JSON.parse(jsonMatch[0]);
        console.log("--- SEMANTIC SEARCH PARSED DATA ---", aiData);
        
        let conditions = [];
        
        if (aiData.location) {
            conditions.push({ location: { $regex: aiData.location, $options: "i" } });
            conditions.push({ country: { $regex: aiData.location, $options: "i" } });
        }
        
        if (aiData.category) {
            conditions.push({ category: aiData.category });
        }

        if (aiData.tags && aiData.tags.length > 0) {
            aiData.tags.forEach(tag => {
                conditions.push({ title: { $regex: tag, $options: "i" } });
                conditions.push({ description: { $regex: tag, $options: "i" } });
                conditions.push({ category: { $regex: tag, $options: "i" } });
            });
        }

        let dbQuery = {};
        if (conditions.length > 0) {
            dbQuery = { $or: conditions };
        }

        const allListings = await Listing.find(dbQuery);
        res.render("listings/index.ejs", { allListings, searchQuery});

    } catch (error) {
        console.error("Semantic Search Failure, dropping back to traditional text matching:", error);
        
        try {
            const standardQuery = req.query.q;
            const fallbackListings = await Listing.find({
                $or: [
                    { location: { $regex: standardQuery, $options: "i" } },
                    { country: { $regex: standardQuery, $options: "i" } },
                    { title: { $regex: standardQuery, $options: "i" } },
                    { description: { $regex: standardQuery, $options: "i" } }
                ]
            });
            return res.render("listings/index.ejs", { allListings: fallbackListings, searchQuery: standardQuery });
        } catch (fallbackError) {
            req.flash("error", "Search is temporarily unavailable.");
            res.redirect("/listings");
        }
    }
};