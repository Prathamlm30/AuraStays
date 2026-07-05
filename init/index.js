const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js"); 

// NEW: Load environment variables from the root directory (.env is one folder up)
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config({ path: "../.env" });
}

// NEW: Use the Atlas connection string from your hidden .env file
const dbUrl = process.env.ATLASDB_URL; 

main()
  .then(() => {
    console.log("Successfully connected to MongoDB Atlas!");
    // Trigger seeding only after a confirmed cloud connection
    initDB();
  })
  .catch((err) => {
    console.log("Database connection error:", err);
  });

async function main() {
  await mongoose.connect(dbUrl);
}

const initDB = async () => {
  try {
    // 1. Clear out any existing listings in the cloud database
    await Listing.deleteMany({});
    
    // 2. SPECIFIC OWNER FIX: Grab the exact user by their username
    const adminUser = await User.findOne({ username: "pratham" }); 

    // Safety check
    if (!adminUser) {
        console.log("❌ ERROR: User 'pratham' not found in the database!");
        mongoose.connection.close();
        return;
    }

    console.log(`✅ Found owner: ${adminUser.username} (ID: ${adminUser._id})`);

    // 3. Map the specific owner ID to each listing
    initData.data = initData.data.map((obj) => ({
        ...obj,
        owner: adminUser._id, 
    }));

    // 4. Insert the sample data into Atlas
    await Listing.insertMany(initData.data);
    console.log("☁️ Cloud database populated with Owners and Geometries!");

  } catch (error) {
    console.log("Seeding failed:", error);
  } finally {
    // 5. Safely close the cloud connection
    mongoose.connection.close(); 
    console.log("Cloud connection closed gracefully.");
  }
};