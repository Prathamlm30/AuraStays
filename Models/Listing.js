const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

const listingSchema = new Schema({
    title : {
        type: String,
        required: true,
    },
    description : String,
    image : {
        url: String,
        filename: String,
    },
    price : Number,
    location : String,
    country : String,
    category: {
        type: String,
        enum: ['Trending', 'Rooms', 'Iconic Cities', 'Mountains', 'Castles', 'Amazing Pools', 'Camping', 'Farms', 'Arctic', 'Domes', 'Boats']
    },
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: "Review",
        },
    ],
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    // MAP COORDINATES FIELD ADDED HERE
    geometry: {
        type: {
            type: String, 
            enum: ['Point'], // The location type must be 'Point'
            required: true
        },
        coordinates: {
            type: [Number], // Array of numbers: [Longitude, Latitude]
            required: true
        }
    }
});

listingSchema.post("findOneAndDelete", async(listing) => {
    if(listing) {
        await Review.deleteMany({_id : {$in: listing.reviews}});
    }   
});

module.exports = mongoose.models.Listing || mongoose.model("Listing", listingSchema);