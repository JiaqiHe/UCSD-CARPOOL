var mangoose = require("mongoose");
var Post = require("./models/post");
var Message = require("./models/message");
var data = [
    {
        departure: "Mesa Nueva",
        destination: "UCSD"
    },
        {
        departure: "SEA WORLD",
        destination: "RALPHS"
    },    
    {
        departure: "99 RANCH",
        destination: "LOS ANGLES"
    }
    ];

function seedDB(){
    Post.remove({}, function(err){
        if(err){
            console.log(err);
        }
        // console.log("removed");
        // data.forEach(function(seed){
        //     Post.create(seed, function(err, post){
        //         if(err){
        //             console.log(err);
        //         }
        //         else {
        //             console.log("added one post");
        //             //create a message
        //             Message.create({
        //                 text: "hi, can you change the time?", 
        //                 author: "H"
        //             }, function(err, message){
        //                 if(err){
        //                     console.log(err);
        //                 } else {
        //                     post.messages.push(message);
        //                     post.save();
        //                     console.log("added a message");
        //                 }
        //             });
        //         }
        //     })
        // });
    });
    
}

module.exports = seedDB;


