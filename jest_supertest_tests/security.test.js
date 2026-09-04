const mongoose = require("mongoose");

// ============================================================================
// CRITICAL FIX: PREVENT BACKGROUND ATLAS CONNECTIONS
// ============================================================================
const originalConnect = mongoose.connect.bind(mongoose);
mongoose.connect = jest.fn().mockResolvedValue(mongoose);

const request = require("supertest");
const app = require("../app"); 
const { MongoMemoryServer } = require("mongodb-memory-server");

// ============================================================================
// MOCKS FOR EXTERNAL SERVICES & SESSION STORE
// ============================================================================
// Prevent real emails/Brevo pings
jest.mock("../utils/email.js", () => jest.fn().mockResolvedValue(true));

// Mock connect-mongo to use MemoryStore during testing
jest.mock("connect-mongo", () => {
    const session = require("express-session");
    class MockStore extends session.MemoryStore {
        on(event, handler) { return this; }
    }
    return jest.fn().mockImplementation(() => MockStore);
});

// Mock global fetch (just in case AI routes are triggered)
global.fetch = jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue([
        { lon: "77.2090", lat: "28.6139" }
    ])
});

let mongoServer;

// ============================================================================
// ENVIRONMENT SETUP & TEARDOWN
// ============================================================================
beforeAll(async () => {
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

// ============================================================================
// OWASP 5-LAYER SECURITY TESTS
// ============================================================================
describe("AuraStays 5-Layer Security Architecture", () => {
    
    // ------------------------------------------------------------------------
    // PHASE 1: The HTTP Shield (Helmet.js)
    // ------------------------------------------------------------------------
    describe("Phase 1: The HTTP Shield", () => {
        it("should hide the tech stack (X-Powered-By) and inject secure headers", async () => {
            const response = await request(app).get("/login");
            
            expect(response.headers["x-powered-by"]).toBeUndefined();
            expect(response.headers["x-frame-options"]).toBeDefined();
            expect(response.headers["content-security-policy"]).toBeDefined();
        });
    });

    // ------------------------------------------------------------------------
    // PHASE 2: The Database Guardian (Mongo Sanitize)
    // ------------------------------------------------------------------------
    describe("Phase 2: The Database Guardian", () => {
        it("should delete MongoDB operator keys (like $gt) to prevent NoSQL Injection", async () => {
            const maliciousPayload = {
                username: "hacker",
                password: { $gt: "" }
            };

            const response = await request(app)
                .post("/login")
                .send(maliciousPayload);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe("/login");
        });
    });

    // ------------------------------------------------------------------------
    // PHASE 3: The Input Cleanser (Sanitize-HTML + Joi)
    // ------------------------------------------------------------------------
    describe("Phase 3: The Input Cleanser", () => {
        it("should strip out hidden <script> tags from property descriptions/reviews", async () => {
            const maliciousReview = {
                review: {
                    rating: 5,
                    comment: "Great place! <script>alert('You have been hacked!')</script>"
                }
            };

            const response = await request(app)
                .post("/listings/fake_id/reviews")
                .send(maliciousReview);

            expect(response.text).not.toContain("<script>alert('You have been hacked!')</script>");
        });
    });

    // ------------------------------------------------------------------------
    // PHASE 4: The Authentication Blocker (Auth Rate Limiting)
    // ------------------------------------------------------------------------
    describe("Phase 4: The Authentication Blocker", () => {
        it("should enforce max login attempts per IP", async () => {
            const loginAttempt = { username: "eshaan", password: "eshaan_49" };

            for (let i = 0; i < 100; i++) {
                await request(app).post("/login").send(loginAttempt);
            }

            const blockedResponse = await request(app).post("/login").send(loginAttempt);
            expect(blockedResponse.status).toBe(429);
            
        }, 30000); 
    });

    // ------------------------------------------------------------------------
    // PHASE 5: The API Wallet Protector (Gemini AI Rate Limiting)
    // ------------------------------------------------------------------------
    describe("Phase 5: The API Wallet Protector", () => {
        it("should enforce rate limiting on Gemini AI routes to prevent quota exhaustion", async () => {
            for (let i = 0; i < 5; i++) {
                await request(app).get("/listings/search?q=beach");
            }

            const blockedResponse = await request(app).get("/listings/search?q=beach");
            expect(blockedResponse.status).toBe(429);
            
        }, 30000); 
    });

});