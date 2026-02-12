// Firebase Configuration and Initialization
// Using Firebase v9+ modular SDK via CDN compat mode for simplicity

const firebaseConfig = {
    apiKey: "AIzaSyAPdNLBq7TRlPys7BCIRiS1dye4nyj_Q3w",
    authDomain: "health-tracker-app-b2bea.firebaseapp.com",
    projectId: "health-tracker-app-b2bea",
    storageBucket: "health-tracker-app-b2bea.firebasestorage.app",
    messagingSenderId: "280912249668",
    appId: "1:280912249668:web:ffa07a5f0cde458c2d4d11"
};

// Initialize Firebase (using compat mode for easier integration)
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Make available globally
window.firebaseAuth = auth;
window.firebaseDb = db;
window.googleProvider = googleProvider;
