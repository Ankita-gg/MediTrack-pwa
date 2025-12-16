MediTrack – Medicine Reminder Progressive Web App (PWA)

MediTrack is a deployed Progressive Web App that reminds users to take medicines on time and helps them locate nearby open medical stores using real time geolocation. The application supports offline usage, push notifications, and installable app behavior, and includes dual authentication with local login and Google sign in.

🚀 Features
⏰ Medicine Reminder

Set medicine name, time, and optional notes

Automatic reminder notifications

Works even if the browser is minimized

Supports SMS reminders (via API)

🏥 Nearest Medicine Shops

Uses the Geolocation API

Shows open medical stores

Ideal for emergencies

🌙 Dark Mode

Toggle between light/dark theme

Saves preference using localStorage

Smooth UI transition

👤 User Login Options

A. Local Login (Offline Login)

Username + password stored securely in localStorage

Simple offline account system

Reminders saved per user

B. Google Login (OAuth 2.0 using Firebase)

One-click secure login

User sessions stored in Firebase

Perfect for production-level apps

Optional, can be enabled anytime

📦 Medicine Database Integration

Local JSON medicine list

Autocomplete search

Extendable to online medical APIs

📱 PWA Features

Installable on mobile/desktop

Offline caching (via Service Worker)

Very fast loading

App icon + splash screen

🛠️ Tech Stack

HTML, CSS, JavaScript

Progressive Web App (PWA)

Service Workers

Geolocation API

Notifications API

Firebase Authentication (optional)

LocalStorage for offline login

📁 Project Structure
MediTrack
│── index.html
│── style.css
│── script.js
│── manifest.json
│── service-worker.js
│── /assets
│── /database
│     └── medicines.json
└── README.md

▶️ How to Run the Project
1️⃣ Install a local server (needed for PWA)

If you have Node.js:

npx http-server


Or use VS Code Live Server.

2️⃣ Open the URL
http://localhost:8080

3️⃣ Install as PWA

Look for the “Install App” or browser “Add to Home Screen”.

🔔 Enabling SMS Reminders

SMS reminders require an SMS API provider such as:

Twilio

Fast2SMS (India-friendly)

In script.js, update:

sendSMS(apiKey, phoneNumber, message);


I’ve included a clean function ready for integration.

🔑 Enabling Google Login (Optional)

To enable Google login:

Create a Firebase project

Enable Authentication → Google provider

Copy Firebase config

Replace the config inside script.js:

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};


Google login will instantly work.

🌙 Dark Mode

Toggle stored in:

localStorage.setItem("theme", "dark" / "light");


CSS variables adjust the theme globally.

📦 Medicine Database

Example JSON file:

[
  "Paracetamol",
  "Aspirin",
  "Ibuprofen",
  "Cetirizine",
  "Azithromycin"
]


Used for autocomplete and selection.

🌱 Future Improvements

Voice reminders

Multi-user profiles

Export/import medicine schedules

Automatic location-based pharmacy updates


Integration with real healthcare APIs
Live Demo

MediTrack is deployed on Netlify and is accessible at the link below. The live version demonstrates full Progressive Web App functionality, including offline support and user authentication.

Live URL
https://meditrack-reminder-app.netlify.app/

Authentication and User Login

MediTrack implements a dual authentication system to support both offline and online usage.

The application provides a local authentication mechanism where user credentials and reminder data are stored securely in local storage, enabling full functionality even without an internet connection. In addition, the application supports Google authentication using Firebase OAuth, allowing users to sign in securely with a Google account when online.

Both authentication methods maintain separate user sessions, ensuring personalized reminders and preferences for each user.

Deployment Details

The application is deployed using Netlify with continuous deployment enabled. The production build includes service worker registration, offline caching, and installable Progressive Web App capabilities, allowing the app to behave like a native mobile application when installed.
