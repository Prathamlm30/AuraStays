const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js"); 

const MONGO_URL = "mongodb://127.0.0.1:27017/airbnb"; 

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  await Listing.deleteMany({});
  
  // DEBUGGER: Let's see exactly what Node is reading from data.js!
  console.log("Data check - First listing geometry is:", initData.data[0].geometry);

  initData.data = initData.data.map((obj) => ({
      ...obj,
      owner: "6a3d91ee3fe445f2463892e7",
  }));

  await Listing.insertMany(initData.data);
  console.log("Data was initialized with Owners and Geometries!");
  
  // FIX: Close the connection so the terminal doesn't hang and fail!
  mongoose.connection.close(); 
};

initDB();