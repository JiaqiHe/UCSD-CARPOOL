var mangoose = require("mongoose");
var Post = require("./models/post");
var Message = require("./models/message");
var User = require("./models/user");

function seedDB(){
    Post.remove({}, function(err){
        if(err){
            console.log(err);
        }
    });
    User.remove({}, function(err){
        if(err){
            console.log(err);
        }
    });
    Message.remove({}, function(err) {
        if(err){
            console.log(err);
        }
    });
}

module.exports = seedDB;


