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
// Task Schema (calendar slots)
// ============================

const taskSchema = new mongoose.Schema({

    username:{
        type:String,
        required:true
    },

    date:{
        type:String,
        required:true
    },

    hour:{
        type:Number,
        min:0,
        max:23
    },

    title:{
        type:String,
        required:true,
        trim:true
    },

    notes:{
        type:String,
        default:""
    },

    color:{
        type:String,
        default:"teal"
    },

    updatedAt:{
        type:Date,
        default:Date.now
    }

});

const Task = mongoose.model("Task", taskSchema);


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
// Tasks API (calendar slots)
// ============================

app.get("/api/tasks", async(req,res)=>{

    if(!req.session.user){
        return res.status(401).json({error:"Not logged in"});
    }

    try{

        const {start,end} = req.query;

        const query = {username:req.session.user};

        if(start && end){
            query.date = {$gte:start, $lte:end};
        }

        const tasks = await Task.find(query).sort({date:1, hour:1});

        res.json(tasks);

    }catch(err){

        console.log(err);
        res.status(500).json({error:"Server error"});

    }

});


app.post("/api/tasks", async(req,res)=>{

    if(!req.session.user){
        return res.status(401).json({error:"Not logged in"});
    }

    try{

        const {date,hour,title,notes,color} = req.body;

        if(!date || !title){
            return res.status(400).json({error:"Missing date or title"});
        }

        const task = new Task({
            username:req.session.user,
            date,
            hour,
            title,
            notes:notes || "",
            color:color || "teal"
        });

        await task.save();

        res.status(201).json(task);

    }catch(err){

        console.log(err);
        res.status(500).json({error:"Server error"});

    }

});


app.put("/api/tasks/:id", async(req,res)=>{

    if(!req.session.user){
        return res.status(401).json({error:"Not logged in"});
    }

    try{

        const {title,notes,color,date,hour} = req.body;

        const task = await Task.findOne({
            _id:req.params.id,
            username:req.session.user
        });

        if(!task){
            return res.status(404).json({error:"Task not found"});
        }

        if(title!==undefined) task.title = title;
        if(notes!==undefined) task.notes = notes;
        if(color!==undefined) task.color = color;
        if(date!==undefined) task.date = date;
        if(hour!==undefined) task.hour = hour;
        task.updatedAt = Date.now();

        await task.save();

        res.json(task);

    }catch(err){

        console.log(err);
        res.status(500).json({error:"Server error"});

    }

});


app.delete("/api/tasks/:id", async(req,res)=>{

    if(!req.session.user){
        return res.status(401).json({error:"Not logged in"});
    }

    try{

        const result = await Task.findOneAndDelete({
            _id:req.params.id,
            username:req.session.user
        });

        if(!result){
            return res.status(404).json({error:"Task not found"});
        }

        res.json({success:true});

    }catch(err){

        console.log(err);
        res.status(500).json({error:"Server error"});

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