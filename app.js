if(process.env.NODE_ENV != "production") {
    require("dotenv").config();
}

const express = require("express");
const app = express();
app.set("trust proxy", 1);
const mongoose = require("mongoose");
//const MONGO_URL = 'mongodb://127.0.0.1:27017/airbnb';
const dbUrl = process.env.ATLASDB_URL;
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate"); 
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./Models/user.js");

// ==========================================
// SECURITY PACKAGES
// ==========================================
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const adminRouter = require("./routes/admin.js");
const legalRouter = require("./routes/legal.js");

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

// ==========================================

// FIX: Express 5 compatibility for sanitization
// ==========================================
app.use((req, res, next) => {
    Object.defineProperty(req, 'query', {
        value: { ...req.query },
        writable: true,
        configurable: true,
        enumerable: true,
    });
    next();
});

// 1. MONGO DB INJECTION PROTECTION
// ==========================================
// Removes prohibited characters (like $) from req.body, req.query, and req.params
app.use(mongoSanitize());

// ==========================================
// 2. HTTP SHIELD (HELMET) & CSP WHITELIST
// ==========================================
app.use(helmet());

const scriptSrcUrls = [
    "https://stackpath.bootstrapcdn.com/",
    "https://api.tiles.mapbox.com/",
    "https://api.mapbox.com/",
    "https://cdnjs.cloudflare.com/",
    "https://cdn.jsdelivr.net/", 
];
const styleSrcUrls = [
    "https://kit-free.fontawesome.com/",
    "https://stackpath.bootstrapcdn.com/",
    "https://api.mapbox.com/",
    "https://api.tiles.mapbox.com/",
    "https://fonts.googleapis.com/",
    "https://use.fontawesome.com/",
    "https://cdn.jsdelivr.net/", 
    "https://cdnjs.cloudflare.com/", 
];
const connectSrcUrls = [
    "https://api.mapbox.com/",
    "https://a.tiles.mapbox.com/",
    "https://b.tiles.mapbox.com/",
    "https://events.mapbox.com/",
];
const fontSrcUrls = [
    "https://fonts.gstatic.com/", 
    "https://cdnjs.cloudflare.com/"
];

app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: [],
            connectSrc: ["'self'", ...connectSrcUrls],
            scriptSrc: ["'unsafe-inline'", "'self'", ...scriptSrcUrls],
            styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
            workerSrc: ["'self'", "blob:"],
            objectSrc: [],
            imgSrc: [
                "'self'",
                "blob:",
                "data:",
                "https://res.cloudinary.com/", // Allows Cloudinary images
                "https://images.unsplash.com/", // For dummy seed images
            ],
            fontSrc: ["'self'", ...fontSrcUrls],
        },
    })
);

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
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
            return cb(null, user);
        }
        
        user = await User.findOne({ email: profile.emails[0].value });
        if(user) {
            user.googleId = profile.id;
            await user.save();
            return cb(null, user);
        }

        const newUser = new User({
            email: profile.emails[0].value,
            username: profile.displayName.replace(/\s+/g, '') + Math.floor(Math.random() * 1000), 
            googleId: profile.id
        });
        
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

// ==========================================
// 3. RATE LIMITERS (Auth Protection)
// ==========================================

// Limits login/signup attempts to 5 per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5, 
    message: "Too many login attempts from this IP, please try again after 15 minutes",
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiters to specific vulnerable routes
app.use("/login", authLimiter);
app.use("/signup", authLimiter);

app.use("/listings",listingRouter);
app.use("/listings/:id/reviews",reviewRouter);
app.use("/",userRouter);
app.use("/admin", adminRouter);
app.use("/legal", legalRouter);

app.get("/", (req, res) => {
  res.redirect("/listings");
});

app.all("/{*path}", (req,res,next) => {
    next(new ExpressError(404,"page not found"));
});

app.use((err,req,res,next) => {
    let {statusCode=500, message="something went wrong"} = err;
    res.status(statusCode).render("listings/error.ejs", {err});
});

app.listen("8080", () => {
    console.log("server is listening to port 8080..");
});