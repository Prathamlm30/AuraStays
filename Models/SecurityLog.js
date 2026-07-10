const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const securityLogSchema = new Schema({
    user: { 
        type: Schema.Types.ObjectId, 
        ref: "User",
        required: true
    },
    ipAddress: String,
    city: String,
    country: String,
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model("SecurityLog", securityLogSchema);