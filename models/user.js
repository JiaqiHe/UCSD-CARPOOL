var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var UserSchema = new mongoose.Schema({
    uername: String,
    password: String,
    trips: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post"
        }
        ]
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);