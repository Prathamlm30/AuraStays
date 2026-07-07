# 🏡 AuraStays

![AuraStays Banner](https://images.unsplash.com/photo-1501183638710-841dd1904471?q=80&w=2070&auto=format&fit=crop)

> A modern, full-stack accommodation booking platform inspired by Airbnb. Built with Node.js, Express, and MongoDB, featuring AI-powered trip insights, interactive mapping, and a seamless reservation engine.

---

## ✨ Key Features

### 🔐 Secure Authentication & Authorization
* **OAuth 2.0 Integration:** Frictionless login and signup using Google Accounts via Passport.js.
* **Local Auth:** Traditional email/password authentication with secure session management and hashing.
* **Role-Based Access Control:** Strict middleware ensuring only property owners can edit or delete their listings, while guests can manage their own reviews and bookings.

### 📅 Advanced Booking Engine
* **Interactive Calendar:** Integrated **Flatpickr** for a dynamic, visually appealing date-selection experience.
* **Real-time Availability:** Backend logic queries MongoDB to block out dates that are already reserved by other guests to prevent double-booking.
* **Trips Dashboard:** A dedicated user portal to view upcoming trips, calculate total costs, and securely cancel reservations with automatic database syncing.

### 🤖 AI-Powered Experience
* **AI Listing Insights:** Generates intelligent summaries analyzing property details, location vibes, and aggregated guest reviews.
* **AI Trip Planner:** Dynamically crafts custom itineraries for guests based on the property's location.
* **Host Smart-Reply:** Allows property owners to draft AI-assisted responses to guest reviews instantly.

### 🗺️ Interactive Maps & Media
* **Geocoding:** Converts physical addresses into geographic coordinates using the **Mapbox API**.
* **Dynamic Mapping:** Renders interactive, zoomable maps on the listing show page to show guests exactly where they will be staying.
* **Cloud Storage:** Image uploads are routed directly to **Cloudinary** for optimized storage and fast delivery.

---

## 🛠️ Tech Stack

**Frontend:**
* HTML5, CSS3, JavaScript (ES6+)
* EJS (Embedded JavaScript Templating)
* Bootstrap 5 (Responsive UI/UX)
* Flatpickr (Date picking engine)

**Backend:**
* Node.js & Express.js
* MongoDB & Mongoose (ODM)
* Passport.js (Authentication & Google OAuth 2.0)
* Joi (Server-side schema validation)

**Cloud & APIs:**
* Mapbox API (Geocoding & Maps)
* Cloudinary (Image Hosting)
* AI SDK (Gemini/OpenAI for Insights & Itineraries)

---

## 📂 Project Structure

```text
AuraStays/
├── controllers/      # Route logic (listings, users, bookings, reviews)
├── models/           # Mongoose schemas (Listing, User, Review, Booking)
├── routes/           # Express router definitions
├── views/            # EJS templates (layouts, listings, users)
├── public/           # Static assets (CSS, client-side JS, images)
├── middleware.js     # Custom authentication and validation middleware
├── cloudConfig.js    # Cloudinary setup
└── app.js            # Main application entry point
```

---

## 🚀 Run Locally

Want to test AuraStays on your local machine? Follow these steps:

### 1. Clone the repository

```bash
git clone https://github.com/your-username/AuraStays.git
cd AuraStays
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Create a `.env` file in the root directory and add the following keys:

```
# Cloudinary Configuration
CLOUD_NAME=your_cloudinary_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret

# Mapbox Configuration
MAP_TOKEN=your_mapbox_public_token

# MongoDB Atlas
ATLASDB_URL=your_mongodb_connection_string

# Express Session Secret
SECRET=your_super_secret_session_key

# Google OAuth 2.0 (If applicable)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 4. Start the Application

```bash
node app.js
```

The application will be running at `http://localhost:8080`.

---

## 🧑‍💻 About the Developer

**Pratham Sharma**

Engineering Student at National Institute of Technology (NIT), Kurukshetra (IIOT)

I built AuraStays to solidify my understanding of full-stack MVC architecture, RESTful API design, and complex database relationships. By integrating third-party APIs (Mapbox, Cloudinary) and custom AI features, this project serves as a comprehensive showcase of modern web development practices.

- [Connect with me on LinkedIn](#)
- [Check out my GitHub Portfolio](#)

*If you like this project, feel free to leave a ⭐ on the repository!*
