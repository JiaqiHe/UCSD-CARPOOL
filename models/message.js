var mongoose = require("mongoose");

var messageSchema = mongoose.Schema({
    text: String,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    },
    time: Date
});

module.exports = mongoose.model("Message", messageSchema);