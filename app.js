if(process.env.NODE_ENV != "production") {
    require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
//const MONGO_URL = 'mongodb://127.0.0.1:27017/airbnb';
const dbUrl = process.env.ATLASDB_URL;
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate"); //ejs-mate is required for creating layouts and templates.
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./Models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const adminRouter = require("./routes/admin.js");

const GoogleStrategy = require('passport-google-oauth20').Strategy;

const MongoStore = require('connect-mongo')(session);

main()
    .then((res) => {
        console.log("connection successfully to DB.");
    })
    .catch((err) => {
        console.log(err);
    });

async function main() {
  await mongoose.connect(dbUrl);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.engine("ejs",ejsMate);
app.use(express.static(path.join(__dirname,"/public")));

// 1. Create the Mongo Store using your cloud database and secret
const store = new MongoStore({
    url: dbUrl,
    secret: process.env.SECRET,
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.log("ERROR in MONGO SESSION STORE", err);
});

// 2. Configure session options to use the store and env secret
const sessionOptions = {
    store: store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    },
};

// app.get("/", (req,res) => {
//     res.send("Hi, I am root!");
// });

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:8080/auth/google/callback",
    proxy: true
  },
  async function(accessToken, refreshToken, profile, cb) {
    try {
        // 1. Check if this Google user already exists in our database
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
            return cb(null, user);
        }
        
        // 2. Check if a user signed up locally with this exact email
        user = await User.findOne({ email: profile.emails[0].value });
        if(user) {
            // Link their new Google ID to their existing local account
            user.googleId = profile.id;
            await user.save();
            return cb(null, user);
        }

        // 3. If they are a brand new user, create a new MongoDB document
        const newUser = new User({
            email: profile.emails[0].value,
            // Generate a unique username from their Google name
            username: profile.displayName.replace(/\s+/g, '') + Math.floor(Math.random() * 1000), 
            googleId: profile.id
        });
        
        // Give them a complex dummy password since they will use Google to log in
        const dummyPassword = Math.random().toString(36).slice(-12);
        const registeredUser = await User.register(newUser, dummyPassword);
        
        return cb(null, registeredUser);
    } catch (err) {
        return cb(err, null);
    }
  }
));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    res.locals.currentPath = req.path;
    next();
});

// app.get("/demouser", async(req,res) => {
//     let fakeUser = new User({
//         email: "student@gmail.com",
//         username: "delta-student",
//     });

//     let registeredUser = await User.register(fakeUser, "helloworld");
//     res.send(registeredUser);
// });

app.use("/listings",listingRouter);
app.use("/listings/:id/reviews",reviewRouter);
app.use("/",userRouter);
app.use("/admin", adminRouter);

app.get("/", (req, res) => {
  res.redirect("/listings");
});

// app.get("/testListing", async (req,res) => {
//     let sampleListing = new Listing({
//         title: "My New Villa",
//         description: "By the beach",
//         price: 1200,
//         location: "Munich",
//         country: "Germany",
//     });

//     await sampleListing.save();
//     console.log("sample was saved");
//     res.send("succesfull");
// });

app.all("/{*path}", (req,res,next) => {
    next(new ExpressError(404,"page not found"));
});

app.use((err,req,res,next) => {
    let {statusCode=500, message="something went wrong"} = err;
    //res.send("something went wrong.")
    //res.status(statusCode).send(message);
    res.status(statusCode).render("listings/error.ejs", {err});
});

app.listen("8080", () => {
    console.log("server is listening to port 8080..");
});