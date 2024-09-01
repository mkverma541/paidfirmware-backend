const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

const app = express();

app.use(session({ secret: 'your-secret-key', resave: true, saveUninitialized: true }));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());


// Set up Google authentication strategy
passport.use(new GoogleStrategy({
    clientID: '1031562036861-2re3h9j69oa9f22ncai1rcb4nm43i66e.apps.googleusercontent.com',
    clientSecret: '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',
    callbackURL: 'http://localhost:3000/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
    const user = {
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
    };
    return done(null, profile);
}));

// Serialize and deserialize user information
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Set up routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/plus.login'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => res.redirect('/')
);
