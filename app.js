const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = 3000;

// ============================
// MongoDB Connection
// ============================

mongoose.connect("mongodb+srv://Yair:Yair2004@cluster0.fg959i9.mongodb.net/")
.then(() => console.log("Connected to MongoDB"))
.catch(err => console.log(err));

// ============================
// Middleware
// ============================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: "weeklyScheduleSecret",
    resave: false,
    saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, "public")));

// ============================
// User Schema
// ============================

const userSchema = new mongoose.Schema({

    username: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    }

});

const User = mongoose.model("User", userSchema);

// ============================
// Home Page
// ============================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "verification.html"));
});

// ============================
// Choice Page
// ============================

app.get("/choice", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/");
    }

    res.sendFile(path.join(__dirname, "public", "choice.html"));

});

// ============================
// Current User
// ============================

app.get("/user", (req, res) => {

    if (!req.session.user) {
        return res.json({ username: "" });
    }

    res.json({ username: req.session.user });

});

// ============================
// Register
// ============================

app.post("/register", async (req, res) => {

    try {

        const { username, password } = req.body;

        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.send("Username already exists.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            password: hashedPassword
        });

        await newUser.save();

        req.session.user = newUser.username;

        res.redirect("/choice");

    } catch (err) {

        console.log(err);
        res.status(500).send("Server Error");

    }

});

// ============================
// Login
// ============================

app.post("/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        const user = await User.findOne({ username });

        if (!user) {
            return res.send("User not found.");
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.send("Incorrect password.");
        }

        req.session.user = user.username;

        res.redirect("/choice");

    } catch (err) {

        console.log(err);
        res.status(500).send("Server Error");

    }

});

// ============================
// Dashboard
// ============================

app.get("/dashboard", (req, res) => {

    if (!req.session.user) {
        return res.send("Please log in first.");
    }

    res.send(`Welcome ${req.session.user}!`);

});

// ============================
// Logout
// ============================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {
        res.redirect("/");
    });

});

// ============================
// Start Server
// ============================

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// test2