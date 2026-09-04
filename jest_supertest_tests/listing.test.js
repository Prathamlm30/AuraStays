const mongoose = require("mongoose");

// ============================================================================
// CRITICAL FIX: PREVENT BACKGROUND ATLAS CONNECTIONS
// ============================================================================
const originalConnect = mongoose.connect.bind(mongoose);
mongoose.connect = jest.fn().mockResolvedValue(mongoose);

const request = require("supertest");
const app = require("../app");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../Models/user.js"); 
const Listing = require("../Models/Listing.js"); 

// ============================================================================
// MOCKS FOR EXTERNAL SERVICES & SESSION STORE
// ============================================================================

global.fetch = jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue([
        { lon: "77.2090", lat: "28.6139" }
    ])
});

jest.mock("../utils/email.js", () => jest.fn().mockResolvedValue(true));

jest.mock("nodemailer", () => ({
    createTransport: jest.fn().mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({ response: '250 Message accepted' }) 
    })
}));

jest.mock("connect-mongo", () => {
    const session = require("express-session");
    class MockStore extends session.MemoryStore {
        on(event, handler) {
            return this;
        }
    }
    return jest.fn().mockImplementation(() => MockStore);
});

jest.mock("multer", () => {
    const multer = () => ({
        single: () => (req, res, next) => {
            req.file = {
                path: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
                filename: "test_image"
            };
            next();
        },
        array: () => (req, res, next) => next()
    });
    multer.diskStorage = () => {};
    return multer;
});

jest.mock("@mapbox/mapbox-sdk/services/geocoding", () => {
    return jest.fn().mockImplementation(() => ({
        forwardGeocode: jest.fn().mockImplementation(() => ({
            send: jest.fn().mockResolvedValue({
                body: { features: [{ geometry: { type: "Point", coordinates: [77.2090, 28.6139] } }] }
            })
        }))
    }));
}, { virtual: true });

let mongoServer;
let agent;
let testUser;
let sampleListingId;

// ============================================================================
// ENVIRONMENT SETUP & TEARDOWN
// ============================================================================
beforeAll(async () => {
    process.env.MAP_TOKEN = "fake_map_token";
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await originalConnect(uri);
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoose.disconnect();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
});

beforeEach(async () => {
    await User.deleteMany({});
    await Listing.deleteMany({});

    testUser = new User({ 
        username: "hostUser", 
        email: "host@aurastays.com",
        isVerified: true,
        role: "admin"
    });
    await User.register(testUser, "password123");

    agent = request.agent(app);
    await agent
        .post("/login")
        .type("form")
        .send({ username: "hostUser", password: "password123" });

    const listing = new Listing({
        title: "Cozy Beachfront Villa",
        description: "A beautiful villa right on the beach.",
        price: 1500,
        location: "Goa",
        country: "India",
        category: "Iconic Cities",
        geometry: {
            type: "Point",
            coordinates: [73.8567, 15.2993]
        },
        image: {
            url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
            filename: "listingimage"
        },
        owner: testUser._id
    });
    const savedListing = await listing.save();
    sampleListingId = savedListing._id;
});

// ============================================================================
// LISTING CRUD OPERATIONS SUITE
// ============================================================================
describe("AuraStays Listing CRUD Operations", () => {

    describe("1. Read Operations (GET)", () => {
        it("should successfully load the listings index page", async () => {
            const response = await request(app).get("/listings");
            expect(response.status).toBe(200);
        });

        it("should fetch a specific listing by its ID", async () => {
            const response = await request(app).get(`/listings/${sampleListingId}`);
            expect(response.status).toBe(200);
        });
    });

    describe("2. Create Operations (POST)", () => {
        it("should allow an authenticated user to create a new listing", async () => {
            const response = await agent
                .post("/listings")
                .type("form")
                .send({
                    "listing[title]": "Mountain Cabin",
                    "listing[description]": "Quiet retreat in the hills.",
                    "listing[price]": 800,
                    "listing[location]": "Manali",
                    "listing[country]": "India",
                    "listing[category]": "Mountains"
                });

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe("/listings");

            const dbListing = await Listing.findOne({ title: "Mountain Cabin" });
            expect(dbListing).not.toBeNull();
            expect(dbListing.price).toBe(800);
            expect(dbListing.owner.toString()).toBe(testUser._id.toString());
        });
    });

    describe("3. Update Operations (PUT)", () => {
        it("should allow the owner to update their listing", async () => {
            const response = await agent
                .post(`/listings/${sampleListingId}?_method=PUT`)
                .type("form")
                .send({
                    "listing[title]": "UPDATED: Cozy Beachfront Villa",
                    "listing[description]": "A beautiful villa right on the beach.",
                    "listing[price]": 2000,
                    "listing[location]": "Goa",
                    "listing[country]": "India",
                    "listing[category]": "Iconic Cities"
                });

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe(`/listings/${sampleListingId}`);

            const updatedListing = await Listing.findById(sampleListingId);
            expect(updatedListing.title).toBe("UPDATED: Cozy Beachfront Villa");
            expect(updatedListing.price).toBe(2000);
        });
    });

    describe("4. Delete Operations (DELETE)", () => {
        it("should initiate the 2-step security OTP deletion pipeline for a listing", async () => {
            const response = await agent
                .post(`/listings/${sampleListingId}?_method=DELETE`);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe("/verify-action");
        });
    });

});