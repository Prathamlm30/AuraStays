const Listing = require("../models/Listing.js");



module.exports.index = async (req, res) => {
    // 1. Extract the search query (q) and category from the URL
    const { q, category } = req.query;
    
    // 2. Start with an empty query object (this fetches ALL listings by default)
    let dbQuery = {};

    // 3. If the user typed something in the search bar
    if (q) {
        dbQuery = {
            $or: [
                { location: { $regex: q, $options: 'i' } }, // 'i' means case-insensitive
                { country: { $regex: q, $options: 'i' } },
                { title: { $regex: q, $options: 'i' } }
            ]
        };
    }

    // 4. If the user clicked a category icon
    if (category) {
        dbQuery.category = category;
    }

    // 5. Fetch listings based on the built query
    const allListings = await Listing.find(dbQuery);

    // 6. Render the page (Optionally, handle what happens if 0 listings are found)
    res.render("listings/index.ejs", { allListings, searchQuery: q });
};

module.exports.renderNewForm = (req,res) => {
    res.render("listings/new.ejs");
};

module.exports.showListing = async (req,res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id).populate({path: "reviews", populate: {path: "author",},}).populate("owner");
    if(!listing) {
        req.flash("error","Listing you requested for does not exist!");
        return res.redirect("/listings");
    }
    console.log(listing);
    res.render("listings/show.ejs", {listing});
};

module.exports.createListing = async (req,res) => {
    // 1. Grab the location and country
    const address = `${req.body.listing.location}, ${req.body.listing.country}`;
    
    // 2. Fetch with a USER-AGENT header so OpenStreetMap doesn't block us!
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`, {
        headers: {
            "User-Agent": "Wanderlust_Airbnb_Clone/1.0" // This acts as your app's ID card
        }
    });
    
    // 3. Now it will successfully parse the JSON
    const data = await response.json();

    // 4. Set fallback geometry (New Delhi)
    let geometry = {
        type: "Point",
        coordinates: [77.2090, 28.6139] 
    };

    // 5. Overwrite with real coordinates if found
    if (data && data.length > 0) {
        geometry.coordinates = [
            parseFloat(data[0].lon), 
            parseFloat(data[0].lat)
        ];
    }

    // 6. Handle image upload
    let url = req.file.path;
    let filename = req.file.filename;
    
    // 7. Create and save listing
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = {url, filename};
    newListing.geometry = geometry; 
    
    await newListing.save();
    
    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
};

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

module.exports.updateListing = async(req,res) => {
    if(!req.body.listing) {
        throw new ExpressError(400, "send valid data for listing.");
    }
    
    let {id} = req.params;

    // 1. Combine the updated location and country from the edit form
    const address = `${req.body.listing.location}, ${req.body.listing.country}`;
    
    // 2. Fetch new coordinates with the User-Agent header to prevent "Access Denied"
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`, {
        headers: {
            "User-Agent": "Wanderlust_Airbnb_Clone/1.0"
        }
    });
    
    const data = await response.json();

    // 3. Prepare the updated listing data object
    const updatedData = { ...req.body.listing };

    // 4. Attach the new coordinates if OpenStreetMap found them
    if (data && data.length > 0) {
        updatedData.geometry = {
            type: "Point",
            coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)]
        };
    }

    // 5. Update the listing in the database with the new text fields and geometry
    let listing = await Listing.findByIdAndUpdate(id, updatedData);

    // 6. Handle the image if the user uploaded a new one during the edit
    if(typeof(req.file) !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        listing.image = {url, filename};
        await listing.save();
    }
    
    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req,res) => {
    let {id} = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    req.flash("success","Listing Deleted!");
    res.redirect("/listings");
}

// ai integration

const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports.getAISummary = async (req, res) => {
    try {
        let { id } = req.params;
        // Fetch the listing AND populate the reviews so we can read them
        const listing = await Listing.findById(id).populate("reviews");

        if (!listing) {
            return res.status(404).json({ error: "Listing not found" });
        }

        // 1. Gather all the review text into one giant string
        const allReviews = listing.reviews.map(r => r.comment).join(" | ");

        // 2. Initialize Gemini
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // 3. Craft the Prompt (This hits all your requirements!)
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

        // 4. Generate the response
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // 5. Send it back to the frontend
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

        // Your highly specific, context-aware system prompt
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
        
        // Send the raw HTML string back to the frontend
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
            You are a backend parsing engine for a travel booking platform. 
            A user has entered the following search query: "${searchQuery}"
            
            Your job is to extract the intended location and the property category.
            The category MUST perfectly match one of these exact strings (case-sensitive): 
            "Trending", "Rooms", "Iconic Cities", "Mountains", "Castles", "Amazing Pools", "Camping", "Farms", "Arctic", "Domes", "Boats".
            
            If you cannot determine a location, leave it as an empty string "".
            If you cannot determine a category from the vibe, leave it as an empty string "".
            
            Respond STRICTLY with a valid JSON object in this exact format:
            {
                "location": "extracted location",
                "category": "extracted category"
            }
        `;

        const result = await model.generateContent(prompt);
        let responseText = await result.response.text();
        
        console.log("\n--- GEMINI RAW OUTPUT ---");
        console.log(responseText);
        
        // AGGRESSIVE JSON CLEANING: Find exactly the {} brackets and ignore everything else
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Gemini did not return valid JSON structure.");
        }
        
        const aiData = JSON.parse(jsonMatch[0]);
        console.log("--- PARSED JSON DATA ---");
        console.log(aiData);
        
        let dbQuery = {};
        
        if (aiData.location) {
            dbQuery.location = { $regex: aiData.location, $options: "i" };
        }
        
        if (aiData.category) {
            dbQuery.category = aiData.category;
        }

        const allListings = await Listing.find(dbQuery);
        res.render("listings/index.ejs", { allListings });

    } catch (error) {
        console.log("\n================ AI SEARCH ERROR (FALLING BACK TO STANDARD SEARCH) ================");
        console.error(error.message || error);
        console.log("===================================================================================\n");
        
        // GRACEFUL DEGRADATION: If the AI fails (rate limit, offline, etc.), 
        // fall back to a standard MongoDB text search on the location and country!
        try {
            const standardQuery = req.query.q;
            const fallbackListings = await Listing.find({
                $or: [
                    { location: { $regex: standardQuery, $options: "i" } },
                    { country: { $regex: standardQuery, $options: "i" } },
                    { title: { $regex: standardQuery, $options: "i" } }
                ]
            });
            
            // Render the results, but let the user know it's a standard search
            req.flash("success", "AI is currently busy. Showing standard search results.");
            return res.render("listings/index.ejs", { allListings: fallbackListings });
            
        } catch (fallbackError) {
            req.flash("error", "Search completely failed. Please try again later.");
            res.redirect("/listings");
        }
    }
};