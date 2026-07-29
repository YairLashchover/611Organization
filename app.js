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
// User/Admin Schema
// ============================

const userSchema = new mongoose.Schema({

    username:{
        type:String,
        required:true,
        unique:true
    },

    password:{
        type:String,
        required:true
    }

});

const User = mongoose.model("User", userSchema, "users");
const Admin = mongoose.model("Admin", userSchema, "admins");


// ============================
// Home Page
// ============================

app.get("/", (req,res)=>{

    res.sendFile(
        path.join(__dirname,"public","verification.html")
    );

});


// ============================
// Choice Page
// ============================

app.get("/choice",(req,res)=>{

    if(!req.session.user){
        return res.redirect("/");
    }

    res.sendFile(
        path.join(__dirname,"public","choice.html")
    );

});


// ============================
// Calendar Page
// ============================

app.get("/calendar",(req,res)=>{

    if(!req.session.user){
        return res.redirect("/");
    }

    res.sendFile(
        path.join(__dirname,"public","calendar.html")
    );

});


// ============================
// Current User
// ============================

app.get("/user",(req,res)=>{

    if(!req.session.user){

        return res.json({
            username:"",
            isAdmin:false
        });

    }

    res.json({

        username:req.session.user,
        isAdmin:req.session.isAdmin

    });

});


// ============================
// Register
// ============================

app.post("/register", async(req,res)=>{

    try{

        const {username,password}=req.body;

        const existingUser = await User.findOne({username});
        const existingAdmin = await Admin.findOne({username});

        if(existingUser || existingAdmin){

            return res.redirect(
                "/?error=Username%20already%20exists"
            );

        }

        const hashedPassword = await bcrypt.hash(password,10);

        const newUser = new User({

            username,
            password:hashedPassword

        });

        await newUser.save();

        req.session.user = newUser.username;
        req.session.isAdmin = false;

        res.redirect("/choice");

    }catch(err){

        console.log(err);

        res.redirect(
            "/?error=Server%20error"
        );

    }

});


// ============================
// Login
// ============================

app.post("/login", async(req,res)=>{

    try{

        const {username,password}=req.body;

        let account = await User.findOne({username});
        let isAdmin = false;

        if(!account){

            account = await Admin.findOne({username});

            if(account){
                isAdmin = true;
            }

        }

        if(!account){

            return res.redirect(
                "/?error=User%20not%20found"
            );

        }

        const validPassword =
            await bcrypt.compare(password,account.password);

        if(!validPassword){

            return res.redirect(
                "/?error=Incorrect%20password"
            );

        }

        req.session.user = account.username;
        req.session.isAdmin = isAdmin;

        res.redirect("/choice");

    }catch(err){

        console.log(err);

        res.redirect(
            "/?error=Server%20error"
        );

    }

});


// ============================
// Dashboard
// ============================

app.get("/dashboard",(req,res)=>{

    if(!req.session.user){

        return res.send(
            "Please log in first."
        );

    }

    if(req.session.isAdmin){

        return res.send(
            `Welcome Admin ${req.session.user}!`
        );

    }

    res.send(
        `Welcome ${req.session.user}!`
    );

});


// ============================
// Logout
// ============================

app.get("/logout",(req,res)=>{

    req.session.destroy(()=>{

        res.redirect("/");

    });

});


// ============================
// Start Server
// ============================

app.listen(PORT,"0.0.0.0",()=>{

    console.log(
        "Server running on http://10.70.248.19(0):3000"
    );

});