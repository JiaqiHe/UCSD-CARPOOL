var mongoose = require("mongoose");

var notificationSchema = mongoose.Schema({
    email: String,
    time: Number,
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post"
    },
    hassent: Boolean
});

module.exports = mongoose.model("Notification", notificationSchema);
