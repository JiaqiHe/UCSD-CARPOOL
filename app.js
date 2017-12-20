var express       = require("express");
var app           = express();
var bodyPaser     = require("body-parser");
var mongoose      = require("mongoose");
var passport      = require("passport");
var LocalStrategy = require("passport-local");
var methodOverride= require("method-override"); 
var flash         = require("connect-flash");
mongoose.connect("mongodb://localhost/carpool", {useMongoClient: true});

var Post          = require("./models/post");
var Message       = require("./models/message");
// var seed          = require("./seeds.js");
var User          = require("./models/user");
// seed();

app.use(methodOverride("_method"));
app.use(bodyPaser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(flash());

// PASSPORT CONFIG
app.use(require("express-session")({
    secret: "UCSDCarpool",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//add user info
app.use(function(req, res, next){
    res.locals.currentUser = req.user;
    res.locals.error       = req.flash("error");
    res.locals.success     = req.flash("success");
    next();
});

//LANDING PAGE
app.get("/", function(req,res){
    res.render("landing.ejs");
});

//=========================
//      POSTS
//=========================

//INDEX - DISPLAY ALL POSTS
app.get("/posts", function(req,res){
    //get all posts from DB
    Post.find({}, function(err, allposts){
        if(err){
            console.log(err);
        } else {
            res.render("posts", {posts:allposts, currentUser:req.user});
        }
    });
});

//CREATE - ADD A NEW POST
app.post("/posts", isLoggedIn, function(req, res){
    //save to DB
    var thisauthor = {
        id: req.user._id,
        username: req.user.username
    };
    var newpost = req.body.newpost;
    newpost["author"] = thisauthor;
    Post.create(newpost, function(err, newlyCreated){
        if(err){
            console.log(err);
        } else {
            User.findById(req.user._id, function(err, foundUser) {
                if(err){
                    req.flash("error", "ERROR!");
                } else {
                    foundUser.trips.push(newlyCreated._id);
                    foundUser.save();
                }
            });
            res.redirect("/posts");
        }
    });
});

//NEW - NEW POST FORM
app.get("/posts/new", isLoggedIn, function(req, res) {
    res.render("new");
});

//SHOW - DISPLAY DETAILED INFO OF A POST
app.get("/posts/:id", isLoggedIn ,function(req, res){
    Post.findById(req.params.id).populate("messages").populate("companion").exec(function(err, foundPost){
        if(err){
            console.log(err);
        } else {
            res.render("show", {foundPost: foundPost});
        }
    });
    // res.render("show");
});

//EDIT - EDIT POST ROUTE
app.get("/posts/:id/edit", checkPostOwnership, function(req, res){
    Post.findById(req.params.id, function(err, foundPost) {
        if(err){
            res.redirect("/posts");
        } else{
            res.render("edit", {post: foundPost});
        }
    });
});

//UPDATE - UPDATE POST ROUTE
app.put("/posts/:id", checkPostOwnership, function(req, res){
    Post.findByIdAndUpdate(req.params.id, req.body.newpost, function(err, updated){
        if(err){
            res.redirect("/posts");
        } else {
            res.redirect("/posts/" + req.params.id);
        }
    });
});

//DESTROY - DELETE POST
app.delete("/posts/:id", checkPostOwnership, function(req, res){
    Post.findByIdAndRemove(req.params.id, function(err){
        if(err){
            res.redirect("/posts");
        } else {
            User.findById(req.user._id, function(err, foundUser) {
                if(err){
                    req.flash("error", "ERROR!");
                } else {
                    var newtrips = [];
                    foundUser.trips.forEach(function(c){
                        if(!c.equals(req.params.id)) newtrips.push(c);
                    });
                    foundUser.trips = newtrips;
                    foundUser.save();
                }
            });
            res.redirect("/posts");
        }
    });
});

//===================
//     MESSAGE
//===================

app.post("/posts/:id/comments", function(req, res){
    //lookup post using id
    Post.findById(req.params.id, function(err, post){
        if(err){
            req.flash("error", "Error!");
            res.redirect("/posts");
        } else {
            var newmessage = {
                text: req.body.text,
                author: {
                    id: req.user._id,
                    username: req.user.username
                }
            };
            Message.create(newmessage, function(err, message){
                if(err){
                    console.log(err);
                } else {
                    post.messages.push(message);
                    post.save();
                    req.flash("success", "Successfully left a message!");
                    res.redirect("/posts/"+post._id);
                }
            });
        }
    })
    //create new commments
});

app.get("/posts/:id/comments/:comment_id/edit", checkMessageOwnership, function(req, res) {
    Post.findById(req.params.id).populate("messages").exec(function(err, foundPost){
        if(err){
            console.log(err);
        } else {
            res.render("edit_comment", {foundPost: foundPost, comment_id:req.params.comment_id});
        }
    });
});

app.put("/posts/:id/comments/:comment_id", checkMessageOwnership, function(req, res){
    Message.findById(req.params.comment_id, function (err, updated) {
        if (err) {
            res.redirect("/posts");
        } else {
            updated.text = req.body.text;
            updated.save(function(err, updatedMessage){
                if (err){
                    console.log("error");
                } else {
                    res.redirect("/posts/" + req.params.id);
                }
            });
        }
    });
});

app.delete("/posts/:id/comments/:comment_id", checkMessageOwnership, function(req, res){
    Message.findByIdAndRemove(req.params.comment_id, function(err){
        if(err){
            res.redirect("back");
        } else {
            res.flash("success", "Message deleted!");
            res.redirect("/posts/" + req.params.id);
        }
    });
});

//===================
//    AUTH ROUTES
//===================

//show register form
app.get("/register", function(req, res) {
    res.render("register");
});

//handle sign up logic
app.post("/register", function(req, res) {
    var newUser = new User({username: req.body.username});
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            req.flash("error", err.message);
            res.redirect("/register");
            return;
        }
        passport.authenticate("local")(req, res, function(){
            req.flash("success", "Welcome to UCSD Carpool, " + user.username + "!");
            res.redirect("/posts");
        });
    });
});

//show login form
app.get("/login", function(req, res) {
    res.render("login");
});

//handle login logic
app.post("/login", passport.authenticate("local", 
    {
        successRedirect:"/posts",
        failureRedirect:"/login"
    }),function(req, res) {
});

// logout route
app.get("/logout", function(req, res) {
    req.logout();
    req.flash("success", "Successfully logged you out!")
    res.redirect("/");
})

//=====================
//        JOIN
//=====================
app.put("/posts/:id/join", isLoggedIn, function(req, res){
    Post.findById(req.params.id, function(err, foundPost) {
        if(err){
            req.flash("error", "ERROR");
            res.redirect("back");
        } else {
            foundPost.companion.push(req.user._id);
            foundPost.save(function(err, updatedPost){
                if (err){
                    req.flash("error", "ERROR!");
                } else {
                    User.findById(req.user._id, function(err, foundUser) {
                        if(err){
                            req.flash("error", "ERROR!");
                        } else {
                            foundUser.trips.push(updatedPost._id);
                            foundUser.save();
                        }
                    });
                    req.flash("success", "You joined this schedule!");
                    res.redirect("/posts/" + req.params.id);
                }
            });
        }
    });
});

app.put("/posts/:id/cancel", isLoggedIn, function(req, res){
    Post.findById(req.params.id, function(err, foundPost) {
        if(err){
            req.flash("error", "ERROR!");
            res.redirect("back");
        } else {
            var newCompanion = foundPost.companion.filter(e => !e.equals(req.user._id));
            foundPost.companion = newCompanion;
            foundPost.save(function(err, updatedPost){
                if(err){
                    req.flash("error", "ERROR!");
                } else {
                    User.findById(req.user._id, function(err, foundUser) {
                        if(err){
                            req.flash("error", "ERROR!");
                        } else {
                            var newtrips = [];
                            foundUser.trips.forEach(function(c){
                                if(!c.equals(updatedPost._id)) newtrips.push(c);
                            });
                            foundUser.trips = newtrips;
                            foundUser.save();
                        }
                    });
                    req.flash("success", "You cancelled this schedule!");
                    res.redirect("/posts/" + req.params.id);
                }
            });
        }
    });
});

//=====================
//       USER PAGE
//=====================
app.get("/user/:user_id", isLoggedIn, function(req, res) {
    User.findById(req.user._id).populate("trips").exec(function(err, foundUser){
        if(err){
            res.flash("error", "ERROR!");
        } else {
            res.render("profile", {user: foundUser});
        }
    });
});

//=====================
//     MIDDLEWARE
//=====================
function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash("error", "You need to Login first. Please Login!");
    res.redirect("/login");
}

function checkPostOwnership(req, res, next){
    if(req.isAuthenticated()){
        Post.findById(req.params.id, function(err, foundPost) {
            if(err){
                req.flash("error", "Error!");
                res.redirect("back");
            } else {
                if(foundPost.author.id.equals(req.user._id)){
                    next();
                } else {
                    req.flash("error", "Sorry, you don't have permission to do that.");
                    res.redirect("back");
                }
            }
        });
    } else{
        req.flash("error", "You need to Login first. Please Login!");
        res.redirect("back");
    }
}

function checkMessageOwnership(req, res, next){
    if(req.isAuthenticated()){
        Message.findById(req.params.comment_id, function(err, foundMessage) {
            if(err){
                res.redirect("back");
            } else {
                if(foundMessage.author.id.equals(req.user._id)){
                    next();
                } else {
                    req.flash("error", "Sorry, you don't have permission to do that.");
                    res.redirect("back");
                }
            }
        });
    } else{
        req.flash("error", "You need to Login first. Please Login!");
        res.redirect("back");
    }
}

app.listen(process.env.PORT, process.env.IP, function(){
    console.log("the carpool server has started");
});



