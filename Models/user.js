const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
    },
    googleId: {
        type: String
    },
    role: {
        type: String,
        enum: ['user', 'admin'], // Only these two strings are allowed
        default: 'user'          // Every new signup gets this by default
    },
    payoutDetails: {
        accountName: String,
        accountNumber: String,
        ifscCode: String
    },
    wishlists: [
        {
            type: Schema.Types.ObjectId,
            ref: "Listing"
        }
    ],
});

// 1. Virtual for counting a user's listings
        userSchema.virtual('totalListings', {
            ref: 'Listing',
            localField: '_id',
            foreignField: 'owner', // Assuming your Listing model uses 'owner' to track the user
            count: true // This tells Mongoose to just return the number, not the whole document!
        });

        // 2. Virtual for counting a user's reviews
        userSchema.virtual('totalReviews', {
            ref: 'Review',
            localField: '_id',
            foreignField: 'author', // Assuming your Review model uses 'author'
            count: true
        })

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);