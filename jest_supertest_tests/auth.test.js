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

// ============================================================================
// MOCKS FOR EXTERNAL SERVICES & SESSION STORE
// ============================================================================
// Prevent real emails/Brevo pings
jest.mock("../utils/email.js", () => jest.fn().mockResolvedValue(true));
jest.mock("nodemailer", () => ({
    createTransport: jest.fn().mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({ response: '250 Message accepted' }) 
    })
}));

// Mock connect-mongo to use MemoryStore during testing
jest.mock("connect-mongo", () => {
    const session = require("express-session");
    class MockStore extends session.MemoryStore {
        on(event, handler) { return this; }
    }
    return jest.fn().mockImplementation(() => MockStore);
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

beforeEach(async () => {
    await User.deleteMany({});
});

// ============================================================================
// AUTHENTICATION & SESSION MANAGEMENT SUITE
// ============================================================================
describe("AuraStays Authentication & Session Pipeline", () => {

    describe("1. User Registration (Signup)", () => {
        it("should accept valid credentials and redirect to OTP verification", async () => {
            const agent = request.agent(app);

            const response = await agent
                .post("/signup")
                .type("form")
                .send({
                    username: "testuser",
                    email: "test@aurastays.com",
                    password: "securePassword123"
                });

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe("/verify-otp");
        });

        it("should handle duplicate registration attempts gracefully", async () => {
            const newUser = { username: "demo", email: "demo@test.com", password: "password123" };

            await request(app)
                .post("/signup")
                .type("form")
                .send(newUser);

            const duplicateResponse = await request(app)
                .post("/signup")
                .type("form")
                .send({
                    username: "demo",
                    email: "different@test.com",
                    password: "password123"
                });

            expect(duplicateResponse.status).toBe(302);
            expect(duplicateResponse.headers.location).toMatch(/\/(signup|verify-otp)/);
        });
    });

    describe("2. User Authentication (Login)", () => {
        beforeEach(async () => {
            const user = new User({ 
                username: "validUser", 
                email: "valid@test.com",
                isVerified: true
            });
            await User.register(user, "correctPassword");
        });

        it("should authenticate valid credentials and set aura_session cookie", async () => {
            const agent = request.agent(app);

            const loginResponse = await agent
                .post("/login")
                .type("form")
                .send({ 
                    username: "validUser", 
                    password: "correctPassword" 
                });

            expect(loginResponse.status).toBe(302);

            const cookies = loginResponse.headers["set-cookie"];
            expect(cookies).toBeDefined();
            expect(cookies.some(cookie => cookie.includes("aura_session"))).toBe(true);
        });

        it("should reject invalid passwords", async () => {
            const agent = request.agent(app);

            const failedLogin = await agent
                .post("/login")
                .type("form")
                .send({ username: "validUser", password: "WRONGpassword" });

            expect(failedLogin.status).toBe(302);
            expect(failedLogin.headers.location).toBe("/login");
        });
    });

    describe("3. Protected Route Guards (Authorization)", () => {
        it("should block unauthenticated access to protected creation routes", async () => {
            const response = await request(app).get("/listings/new");

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe("/login");
        });

        it("should allow authenticated session users to reach protected routes", async () => {
            const agent = request.agent(app);

            const user = new User({ 
                username: "authorizedUser", 
                email: "auth@test.com",
                isVerified: true
            });
            await User.register(user, "pass123");

            await agent
                .post("/login")
                .type("form")
                .send({ 
                    username: "authorizedUser", 
                    password: "pass123" 
                });

            const protectedResponse = await agent.get("/listings/new");
            expect(protectedResponse.status).toBe(200);
        });
    });

    describe("4. Session Termination (Logout)", () => {
        it("should clear session and revoke protected route access on logout", async () => {
            const agent = request.agent(app);

            const user = new User({ 
                username: "logoutUser", 
                email: "logout@test.com",
                isVerified: true
            });
            await User.register(user, "pass123");

            await agent
                .post("/login")
                .type("form")
                .send({ 
                    username: "logoutUser", 
                    password: "pass123" 
                });

            const logoutResponse = await agent.get("/logout");
            expect(logoutResponse.status).toBe(302);

            const postLogoutResponse = await agent.get("/listings/new");
            expect(postLogoutResponse.status).toBe(302);
            expect(postLogoutResponse.headers.location).toBe("/login");
        });
    });
});