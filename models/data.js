var mongoose = require("mongoose");

var dataSchema = mongoose.Schema({
    name: String,
    webpage_visit: Number,
    user: Number,
    post: Number,
    message: Number,
    email: Number
});

module.exports = mongoose.model("Data", dataSchema);