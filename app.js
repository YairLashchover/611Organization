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

mongoose.connect(
    "mongodb+srv://Yair:Yair2004@cluster0.fg959i9.mongodb.net/"
)
.then(() => console.log("Connected to MongoDB"))
.catch(err => console.log(err));




// ============================
// Middleware
// ============================

app.use(express.urlencoded({
    extended:true
}));

app.use(express.json());


app.use(session({

    secret:"weeklyScheduleSecret",

    resave:false,

    saveUninitialized:false

}));


app.use(express.static(
    path.join(__dirname,"public")
));






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





const User = mongoose.model(
    "User",
    userSchema,
    "users"
);



const Admin = mongoose.model(
    "Admin",
    userSchema,
    "admins"
);








// ============================
// Assignment Schema
// ============================

const assignmentSchema = new mongoose.Schema({

    assignedUser:{

        type:String,

        required:true

    },



    taskType:{

        type:String,

        enum:[

            "Kitchen",
            "Guarding",
            "Other"

        ],

        required:true

    },



    customName:{

        type:String,

        default:""

    },



    date:{

        type:String,

        required:true

    },



    startTime:{

        type:String,

        required:true

    },



    endTime:{

        type:String,

        required:true

    },



    createdBy:{

        type:String,

        required:true

    },



    createdAt:{

        type:Date,

        default:Date.now

    }


});




const Assignment = mongoose.model(
    "Assignment",
    assignmentSchema
);









// ============================
// Helper:
// Get Sunday of current week
// ============================

function getStartOfWeek(){

    const today = new Date();

    const day = today.getDay();


    const sunday = new Date(today);


    sunday.setDate(
        today.getDate()-day
    );


    sunday.setHours(
        0,
        0,
        0,
        0
    );


    return sunday;

}







// ============================
// Delete old assignments
// ============================

async function clearOldAssignments(){


    try{


        const sunday =
            getStartOfWeek();



        const oldAssignments =
            await Assignment.find();



        for(const task of oldAssignments){


            const taskDate =
                new Date(task.date);



            if(taskDate < sunday){


                await Assignment.findByIdAndDelete(
                    task._id
                );


            }


        }


    }
    catch(err){

        console.log(
            "Cleanup error:",
            err
        );

    }


}





setInterval(
    clearOldAssignments,
    1000 * 60 * 60
);









// ============================
// Home Page
// ============================

app.get("/",(req,res)=>{


    res.sendFile(

        path.join(
            __dirname,
            "public",
            "verification.html"
        )

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

        path.join(
            __dirname,
            "public",
            "choice.html"
        )

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

        path.join(
            __dirname,
            "public",
            "calendar.html"
        )

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

app.post("/register",async(req,res)=>{


    try{


        const {
            username,
            password
        } = req.body;




        const existingUser =
            await User.findOne({
                username
            });



        const existingAdmin =
            await Admin.findOne({
                username
            });





        if(existingUser || existingAdmin){


            return res.redirect(
                "/?error=Username%20already%20exists"
            );


        }






        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );






        const newUser =
            new User({

                username,

                password:hashedPassword

            });





        await newUser.save();






        req.session.user =
            username;



        req.session.isAdmin =
            false;




        res.redirect("/choice");



    }
    catch(err){


        console.log(err);



        res.redirect(
            "/?error=Server%20error"
        );


    }



});











// ============================
// Login
// ============================

app.post("/login",async(req,res)=>{


    try{


        const {

            username,

            password

        } = req.body;






        let account =
            await User.findOne({
                username
            });




        let isAdmin=false;






        if(!account){


            account =
                await Admin.findOne({
                    username
                });



            if(account){

                isAdmin=true;

            }


        }






        if(!account){


            return res.redirect(
                "/?error=User%20not%20found"
            );


        }







        const validPassword =
            await bcrypt.compare(

                password,

                account.password

            );






        if(!validPassword){


            return res.redirect(
                "/?error=Incorrect%20password"
            );


        }








        req.session.user =
            account.username;



        req.session.isAdmin =
            isAdmin;






        res.redirect("/choice");



    }
    catch(err){


        console.log(err);



        res.redirect(
            "/?error=Server%20error"
        );


    }


});












// ============================
// Get All Users
// Admin Only
// ============================

app.get("/api/users",async(req,res)=>{


    if(!req.session.user){


        return res.status(401).json({

            error:"Not logged in"

        });


    }





    if(!req.session.isAdmin){


        return res.status(403).json({

            error:"Admins only"

        });


    }






    try{


        const users =
            await User.find(
                {},
                {
                    username:1,
                    _id:0
                }
            );



        const admins =
            await Admin.find(
                {},
                {
                    username:1,
                    _id:0
                }
            );





        res.json([

            ...users,

            ...admins

        ]);



    }
    catch(err){


        console.log(err);



        res.status(500).json({

            error:"Server error"

        });


    }


});











// ============================
// Get Assignments
//
// Admin:
// sees all tasks
//
// User:
// sees only his tasks
// ============================

app.get("/api/assignments",async(req,res)=>{


    if(!req.session.user){


        return res.status(401).json({

            error:"Not logged in"

        });


    }





    try{


        const {

            date

        } = req.query;





        let query={};







        if(req.session.isAdmin){



            if(date){

                query.date=date;

            }


        }
        else{


            query.assignedUser =
                req.session.user;



            if(date){

                query.date=date;

            }


        }







        const assignments =
            await Assignment
            .find(query)
            .sort({

                startTime:1

            });







        res.json(assignments);



    }
    catch(err){


        console.log(err);



        res.status(500).json({

            error:"Server error"

        });


    }



});











// ============================
// Get task dots for calendar
// ============================
//
// Returns tasks grouped by date
// Used for showing dots
// ============================

app.get("/api/calendar-dots",async(req,res)=>{


    if(!req.session.user){


        return res.status(401).json({

            error:"Not logged in"

        });


    }






    try{


        let query={};




        if(!req.session.isAdmin){


            query.assignedUser =
                req.session.user;


        }







        const tasks =
            await Assignment.find(query);






        let result={};






        tasks.forEach(task=>{



            if(!result[task.date]){


                result[task.date]=[];

            }




            result[task.date].push({

                type:task.taskType

            });



        });






        res.json(result);



    }
    catch(err){


        console.log(err);



        res.status(500).json({

            error:"Server error"

        });


    }


});











// ============================
// Check weekly task limit
// ============================

app.get("/api/check-week-tasks/:username",
async(req,res)=>{


    if(!req.session.user || !req.session.isAdmin){


        return res.status(403).json({

            error:"Admins only"

        });


    }






    try{


        const sunday =
            getStartOfWeek();





        const tasks =
            await Assignment.find({

                assignedUser:req.params.username

            });





        let count=0;





        tasks.forEach(task=>{


            const taskDate =
                new Date(task.date);




            if(taskDate >= sunday){


                count++;


            }


        });







        res.json({

            count

        });



    }
    catch(err){


        console.log(err);



        res.status(500).json({

            error:"Server error"

        });


    }



});

// ============================
// Create Assignment
// Admin Only
// ============================

app.post("/api/assignments",async(req,res)=>{


    if(!req.session.user){


        return res.status(401).json({

            error:"Not logged in"

        });


    }






    if(!req.session.isAdmin){


        return res.status(403).json({

            error:"Admins only"

        });


    }






    try{


        const {

            assignedUser,

            taskType,

            customName,

            date,

            startTime,

            endTime,

            ignoreLimit

        } = req.body;








        if(

            !assignedUser ||

            !taskType ||

            !date ||

            !startTime ||

            !endTime

        ){


            return res.status(400).json({

                error:"Missing information"

            });


        }








        // ============================
        // Check weekly limit
        // ============================

        if(!ignoreLimit){



            const sunday =
                getStartOfWeek();





            const userTasks =
                await Assignment.find({

                    assignedUser

                });





            let count=0;






            userTasks.forEach(task=>{


                const taskDate =
                    new Date(task.date);



                if(taskDate >= sunday){


                    count++;


                }


            });







            if(count >= 2){



                return res.json({

                    needConfirm:true,

                    message:
                    `${assignedUser} כבר יש 2 משימות השבוע, האם אתה בטוח שאתה רוצה להוסיף לו עוד?`


                });


            }



        }









        const assignment =
            new Assignment({


                assignedUser,


                taskType,



                customName:
                    taskType==="Other"
                    ?
                    customName
                    :
                    "",



                date,



                startTime,



                endTime,



                createdBy:
                    req.session.user



            });







        await assignment.save();






        res.json({

            success:true,

            assignment

        });




    }
    catch(err){


        console.log(err);



        res.status(500).json({

            error:"Server error"

        });


    }



});












// ============================
// Delete Assignment
// Admin Only
// ============================

app.delete("/api/assignments/:id",
async(req,res)=>{


    if(!req.session.user){


        return res.status(401).json({

            error:"Not logged in"

        });


    }







    if(!req.session.isAdmin){


        return res.status(403).json({

            error:"Admins only"

        });


    }







    try{


        const deleted =

            await Assignment.findByIdAndDelete(

                req.params.id

            );






        if(!deleted){


            return res.status(404).json({

                error:"Assignment not found"

            });


        }







        res.json({

            success:true

        });



    }
    catch(err){


        console.log(err);



        res.status(500).json({

            error:"Server error"

        });


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

app.listen(

    PORT,

    "0.0.0.0",

    ()=>{


        console.log(

            "Server running on http://10.70.248.190:3000"

        );


    }

);