var express = require("express");
var router = express.Router();
var Post = require("../models/post");

router.use(function(req, res, next){
    res.locals.currentUser = req.user;
    next();
});

//INDEX - DISPLAY ALL POSTS
router.get("/posts", function(req,res){
    //get all posts from DB
    Post.find({}, function(err, allposts){
        if(err){
            console.log(err);
        } else {
            res.render("posts", {posts:allposts});
        }
    });
    // res.render("posts", {posts:posts});
});

//CREATE - ADD A NEW POST
router.post("/posts", function(req, res){
    // //get data from form
    // var departure = req.body.departure;
    // var destination = req.body.destination;
    // var newpost = {
    //     departure:departure,
    //     destination:destination
    // };
    //save to DB
    console.log(req.body.newpost);
    Post.create(req.body.newpost, function(err, newlyCreated){
        if(err){
            console.log(err);
        } else {
            res.redirect("/posts");
        }
    });
});

//NEW - NEW POST FORM
router.get("/posts/new", isLoggedIn, function(req, res) {
    res.render("new");
});

//SHOW - DISPLAY DETAILED INFO OF A POST
router.get("/posts/:id", isLoggedIn ,function(req, res){
    Post.findById(req.params.id).populate("messages").exec(function(err, foundPost){
        if(err){
            console.log(err);
        } else {
            res.render("show", {foundPost: foundPost});
        }
    });
    // res.render("show");
});

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect("/login");
}
module.exports = router;