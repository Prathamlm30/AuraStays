const Listing = require("../Models/Listing.js");
const Review = require("../Models/review.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");


module.exports.createReview = async(req,res) => {
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    listing.reviews.push(newReview);

    await newReview.save();
    await listing.save();

    // console.log("new review saved.");
    // res.send("new review saved.");
    req.flash("success","New Review Created!");
    res.redirect(`/listings/${listing._id}`);
};

module.exports.destroyReview = async(req,res) => {
    let {id,reviewId} = req.params;
    await Listing.findByIdAndUpdate(id,{$pull: {reviews: reviewId}});
    await Review.findByIdAndDelete(reviewId);

    req.flash("success","Review Deleted!");
    res.redirect(`/listings/${id}`);
};

module.exports.generateAIReply = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const review = await Review.findById(reviewId);
        
        if (!review) {
            return res.status(404).json({ error: "Review not found in database." });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            You are a professional, highly-rated Airbnb host. Write a short, polite reply (maximum 3 sentences) to the following guest review.
            
            Guest Rating: ${review.rating} out of 5 stars.
            Guest Comment: "${review.comment}"
            
            Instructions:
            - If the review is 4 or 5 stars, thank them warmly and invite them back.
            - If the review is 3 stars or below, apologize professionally, do not make excuses, and state you will improve the experience.
            - Keep it plain text, no markdown.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        // Safety check: Did Gemini block the response?
        if (!response.text()) {
            return res.status(500).json({ error: "Gemini safety filters blocked this response." });
        }
        
        res.json({ reply: response.text() });

    } catch (error) {
        // This will print the EXACT reason to your Node terminal
        console.log("\n================ GEMINI API ERROR ================");
        console.error(error.message || error);
        console.log("==================================================\n");

        // Check if it's a Rate Limit (Too Many Requests)
        if (error.status === 429 || (error.message && error.message.includes("429"))) {
            return res.status(429).json({ error: "Google API is busy (Rate Limit). Wait 30 seconds and try again." });
        }

        // Generic fallback error
        res.status(500).json({ error: "Server failed to connect to Gemini API. Check terminal logs." });
    }
};


module.exports.createReply = async (req, res) => {
    // 1. Grab the listing ID and review ID from the URL
    let { id, reviewId } = req.params;
    
    // 2. Grab the text the host typed into the box
    let { hostReply } = req.body; 
    
    // 3. Find the review and update it
    let review = await Review.findById(reviewId);
    if (!review) {
        req.flash("error", "Review not found!");
        return res.redirect(`/listings/${id}`);
    }

    review.hostReply = hostReply;
    await review.save(); // Save it permanently to MongoDB
    
    req.flash("success", "Reply posted successfully!");
    res.redirect(`/listings/${id}`); // Refresh the page to show the new reply
};

module.exports.deleteReply = async (req, res) => {
    let { id, reviewId } = req.params;
    
    // Find the review and completely remove the hostReply field
    await Review.findByIdAndUpdate(reviewId, { $unset: { hostReply: "" } });
    
    req.flash("success", "Reply deleted successfully!");
    res.redirect(`/listings/${id}`);
};

