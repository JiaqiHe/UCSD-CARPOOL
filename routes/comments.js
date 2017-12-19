var express = require("express");
var router = express.Router();
var Post = require("../models/post");
var Message = require("../models/message");

router.post("/posts/:id/comments", function(req, res){
    //lookup post using id
    Post.findById(req.params.id, function(err, post){
        if(err){
            console.log(err);
            res.redirect("/posts");
        } else {
            var newmessage = {
                text: req.body.text,
                author: req.user.username
            };
            Message.create(newmessage, function(err, message){
                if(err){
                    console.log(err);
                } else {
                    post.messages.push(message);
                    post.save();
                    res.redirect("/posts/"+post._id);
                }
            });
        }
    })
    //create new commments
});

module.exports = router;
