var express       = require("express");
var app           = express();
var bodyParser     = require("body-parser");
var mongoose      = require("mongoose");
var passport      = require("passport");
var LocalStrategy = require("passport-local").Strategy;
var methodOverride= require("method-override"); 
var flash         = require("connect-flash");
var bcrypt        = require('bcrypt-nodejs');
var async         = require('async');
var crypto        = require('crypto');
var nodemailer    = require("nodemailer");
const sgMail      = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

var url = process.env.DATABASEURL || "mongodb://localhost/carpool";
// mongoose.connect("mongodb://localhost/carpool", {useMongoClient: true});
mongoose.connect(url);


var Post          = require("./models/post");
var Message       = require("./models/message");
var User          = require("./models/user");
var Data          = require("./models/data");
var Notification  = require("./models/notification");
// var seed          = require("./seeds.js");
// seed();

app.use(methodOverride("_method"));
app.use(bodyParser.urlencoded({extended: true}));
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

passport.use(new LocalStrategy(function(username, password, done) {
  User.findOne({ username: username }, function(err, user) {
    if (err) return done(err);
    if (!user) return done(null, false, { message: 'Incorrect username.' });
    user.comparePassword(password, function(err, isMatch) {
      if (isMatch) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Incorrect password.' });
      }
    });
  });
}));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});


//add user info
app.use(function(req, res, next){
    res.locals.currentUser = req.user;
    res.locals.error       = req.flash("error");
    res.locals.success     = req.flash("success");
    next();
});

Data.findOne({name: "data"}, function(err, data) {
    if(err){
        console.log(err);
    } else {
        if(!data){
            var d = {
                name: "data",
                webpage_visit: 0,
                user: 0,
                post: 0,
                message: 0,
                email: 0
            };
            Data.create(d);
        }
    }
});

User.findOne({username: "admin"}, function(err, admin) {
    if(err){
        console.log(err);
    } else {
        if(!admin){
            var ad = {
                username: "admin",
                password: "admin",
                email: "admin@test.com"
            }
            User.create(ad);
        }
    }
});

//LANDING PAGE
app.get("/", function(req,res){
    updateVisit();
    res.render("landing.ejs");
});

app.get("/help", function(req, res) {
    res.render("instruction");
})
//=========================
//      POSTS
//=========================

//INDEX - DISPLAY ALL POSTS
app.get("/posts", function(req,res){
    updateVisit();
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
    var timezone = Number(newpost.timezone[6]);
    var schedule_time = Date.parse(newpost.date) + (Number(newpost.time_hour) + timezone)*3600*1000 + Number(newpost.time_minute)*60*1000;
    if(newpost.time_apm === "p.m.") schedule_time = schedule_time + 12*3600*1000;
    newpost["schedule_time"] = schedule_time;
    var d = new Date();
    var cur = d.getTime();
    if(cur > schedule_time){
        req.flash("error", "Your departure time cannot be set in the past.");
        return res.redirect("back");
    }
    addPost();
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
                    Notification.create({
                        email: foundUser.email, 
                        time: schedule_time - 3600*1000, 
                        post: newlyCreated._id, 
                        hassent: false
                    });
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
    updateVisit();
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
                var timezone = Number(updated.timezone[6]);
                var schedule_time = Date.parse(updated.date) + (Number(updated.time_hour) + timezone)*3600*1000 + Number(updated.time_minute)*60*1000;
                if(updated.time_apm === "p.m.") schedule_time = schedule_time + 12*3600*1000;
                updated.schedule_time = schedule_time;
                updated.save();
                console.log(updated.schedule_time);
                Notification.update({post:updated._id}, {$set: {time: schedule_time - 3600*1000}});
            res.redirect("/posts/" + req.params.id);
        }
    });
});

//DESTROY - DELETE POST
app.delete("/posts/:id", checkPostOwnership, function(req, res){
    subtractPost();
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
                    Message.remove({post: req.params.id});
                    Notification.remove({post: req.params.id});
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
    addMessage();
    //lookup post using id
    Post.findById(req.params.id, function(err, post){
        if(err){
            req.flash("error", "Error!");
            res.redirect("/posts");
        } else {
            var d = new Date();
            var newmessage = {
                text: req.body.text,
                author: {
                    id: req.user._id,
                    username: req.user.username
                },
                time: d,
                post: req.params.id
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
            var d = new Date();
            updated.time = d;
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
    subtractMessage();
    Message.findByIdAndRemove(req.params.comment_id, function(err){
        if(err){
            res.redirect("back");
        } else {
            req.flash("success", "Message deleted!");
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

app.post('/register', function(req, res) {
    if(req.body.password !== req.body.confirm){
        req.flash("error", "The password you typed in doesn't match!");
        return res.redirect("/resigter");
    }
    updateUser();
  var user = new User({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password
    });

  user.save(function(err) {
      if(err){
          req.flash("error", "ERROR!");
          res.redirect("back");
      } else {
          req.logIn(user, function(err) {
              if(err){
                  req.flash("error", "ERROR!");
                  res.redirect("back");
              } else {
                  req.flash("success", "Welcome to UCSD Carpool, " + user.username + "!");
                  res.redirect('/posts');
              }
          });
      }
  });
});

//show login form
app.get("/login", function(req, res) {
    res.render("login");
});

app.post('/login', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) return next(err)
    if (!user) {
        req.flash("error", "Incorrect username or password. Please try again!");
        res.redirect('/login');
    } else {
        req.logIn(user, function(err) {
            if (err) {
                console.log(err);
                return next(err);
            } else {
                req.flash("success", "Welcome back, " + user.username + "!");
                return res.redirect('/posts');
            }
        });
    }
  })(req, res, next);
});

// logout route
app.get("/logout", function(req, res) {
    req.logout();
    req.flash("success", "Successfully logged you out!")
    res.redirect("/posts");
});

app.get("/forgot", function(req, res) {
    res.render("forgot", {user: req.user});
});

app.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
        updateEmail();
    const msg = {
        to: user.email,
        from: 'ucsdcarpool@gmail.com',
        subject: 'Reset Password for UCSD CARPOOL',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
              'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
              'http://' + req.headers.host + '/reset/' + token + '\n\n' +
              'If you did not request this, please ignore this email and your password will remain unchanged.\n'
    };
    sgMail.send(msg, function(err){
        if(err){
            console.log(err);
            req.flash("error", "OOPS! ERROR! TRY AGAIN!");
            return res.redirect("back");
        } else {
            req.flash('success', 'An e-mail has been sent to your mailbox with further instructions. [IMPORTANT: This e-mail may be filtered into Junk mailbox.]');
            res.redirect("/forgot");
        }
    });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

app.get('/reset/:token', function(req, res) {
    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if(err){
            req.flash("error", "ERROR!");
            res.redirect("/forgot");
        } else {
            if (!user) {
                console.log(user);
                req.flash('error', 'Password reset token is invalid or has expired.');
                return res.redirect('/forgot');
            }
            res.render('reset', {user: req.user, token: req.params.token});
        }
    });
});

app.post('/reset/:token', function(req, res) {
    if(req.body.password !== req.body.confirm){
        req.flash("error", "The password you typed in doesn't match!");
        return res.redirect("back");
    }
    User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now()}}, function(err, user){
        if(err){
            req.flash("error", "ERROR!");
            res.redirect("/forgot");
        } else {
            if(!user){
                req.flash('error', 'Password reset token is invalid or has expired.');
                return res.redirect('/forgot');
            } else {
                user.password = req.body.password;
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;
                user.save(function(err){
                    if(err){
                        req.flash("error", "Failure to change password. Try again.");
                        return res.redirect("/forgot");
                    } 
                    req.logIn(user, function(err){
                        if(err){
                            req.flash("success", "You have successfully changed your password!");
                            res.redirect("/login");
                        } else {
                            req.flash("success", "You have successfully changed your password!");
                            res.redirect("/posts");
                        }
                    })
                })
            }
        }
    });
});

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
                            Notification.create({
                                email: foundUser.email, 
                                time: updatedPost.schedule_time - 3600*1000, 
                                post: updatedPost._id, 
                                hassent: false
                            });
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
                            Notification.remove({
                                email: foundUser.email, 
                                time: updatedPost.schedule_time - 3600*1000, 
                                post: updatedPost._id
                            });
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
    updateVisit();
    User.findById(req.user._id).populate("trips").exec(function(err, foundUser){
        if(err){
            res.flash("error", "ERROR!");
        } else {
            res.render("profile", {user: foundUser});
        }
    });
});

//=====================
//        DATA
//=====================
app.get("/data", isAdmin, function(req, res) {
    Data.findOne({name: "data"}, function(err, data) {
        res.render("data", {data: data});
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

function isAdmin(req, res, next){
    if(req.user.username === "admin"){
        return next();
    }
    req.flash("error", "Sorry, you don't have permission to visit this page.");
    res.redirect("/posts");
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

function updateVisit(){
    Data.findOne({name: "data"}, function(err, data) {
        if(err){
            console.log(err);
        } else {
            data.webpage_visit = data.webpage_visit + 1;
            data.save();
        }
    });
}

function updateUser(){
    Data.findOne({name: "data"}, function(err, data) {
        if(err){
            console.log(err);
        } else {
            data.user = data.user + 1;
            data.save();
        }
    });
}

function addPost(){
    Data.findOne({name: "data"}, function(err, data) {
        if(err){
            console.log(err);
        } else {
            data.post = data.post + 1;
            data.save();
        }
    });
}

function subtractPost(){
    Data.findOne({name: "data"}, function(err, data) {
        if(err){
            console.log(err);
        } else {
            data.post = data.post - 1;
            data.save();
        }
    });
}

function addMessage(){
    Data.findOne({name: "data"}, function(err, data) {
        if(err){
            console.log(err);
        } else {
            data.message = data.message + 1;
            data.save();
        }
    });
}

function subtractMessage(){
    Data.findOne({name: "data"}, function(err, data) {
        if(err){
            console.log(err);
        } else {
            data.message = data.message - 1;
            data.save();
        }
    });
}

function updateEmail(){
    Data.findOne({name: "data"}, function(err, data) {
        if(err){
            console.log(err);
        } else {
            data.email = data.email + 1;
            data.save();
        }
    });
}

function sendnotification(email, post){
    const msg = {
        to: email,
        from: 'ucsdcarpool@gmail.com',
        subject: 'Less Than An Hour Before Departure',
        text: 'Get Ready for your schedule: ' + post.departure + ' - ' + post.destination 
        + ' on ' + post.date + ' at ' + post.time_hour + ':' + post.time_minute + ' ' + post.time_apm + '! \n\n' +
        'You have less than an hour before departure!\n\n'
    };
    sgMail.send(msg);
    updateEmail();
}
//=======================
//    NOTIFICATION
//=======================
var TIME_INTERVAL_IN_MILLIS = 60000*10; //10 minutes

var reminder = function() {
    //go over notification database
    var now = new Date().getTime() - 3600*1000;
    Notification.find({
        time:{$gt: now}
    }, function(err, tosend){
        if(err){
            console.log(err);
        } else {
            if(!tosend){
                    tosend.forEach(function(task){
                    Post.findById(task.post, function(err, foundPost) {
                        if(err){
                            console.log(err);
                        } else {
                            sendnotification(task.email, foundPost);
                            task.hassent = true;
                            task.save();
                        }
                    })
                    Notification.remove({hassent: true});
                })
            }
        }
    });
    setTimeout(reminder, getNextMinute(now));
}

var getNextMinute = function(now) {
  var timePassed = now % TIME_INTERVAL_IN_MILLIS;
  return TIME_INTERVAL_IN_MILLIS - timePassed;
}

reminder();

app.listen(process.env.PORT, process.env.IP, function(){
    console.log("the carpool server has started");
});



