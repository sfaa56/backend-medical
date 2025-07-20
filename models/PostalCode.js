const mongoose = require("mongoose");


const PostalCodeSchema = new mongoose.Schema({
    code:{type:String,required:true},
    active:{type:Boolean,default:true},
    district:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "District",
    }
})

module.exports = mongoose.model('PostalCode',PostalCodeSchema); // Not a model because it's nested