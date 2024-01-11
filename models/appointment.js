const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const newAppointmentSchema = new Schema({
    name:String,
    email:String,
    phone:String,
    department:String,
    doctor:String,
    reason:String,
    date:Date
  }
  , {
    versionKey: false, // This will disable the __v field
  });

  const newAppointmentData = mongoose.model('appointment', newAppointmentSchema);
module.exports = newAppointmentData;