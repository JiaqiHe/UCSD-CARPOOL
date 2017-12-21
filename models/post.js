var mongoose = require("mongoose");

//SCHEMA SETUP
var postSchema = new mongoose.Schema({
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    },
    departure: String,
    destination: String,
    time: String,
    slots: String,
    date: String,
    time_hour: String,
    time_minute: String,
    time_apm: String,
    timezone: String,
    schedule_time: Number,
    messages: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message"
        }
        ],
    companion: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
        ]
});

module.exports = mongoose.model("Post", postSchema);