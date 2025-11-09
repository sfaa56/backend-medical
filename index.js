// index.js
const express = require("express");
const connectDb = require("./config/dbConnection");
const dotenv = require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 5000;
const cookieParser = require("cookie-parser");
const cors = require('cors');
const http = require("http");

const { initSocket,getSocket } = require("./config/socket");


connectDb();

app.use(cors({
  origin:[process.env.front_url,"http://localhost:3001"], // frontend
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());


const server = http.createServer(app);
initSocket(server);

// بعد كل app.use للـ routes
app.use((req, res, next) => {
  req.io = getSocket();
  next();
});


app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/user"));
app.use("/api/experience", require("./routes/experience.route"));
app.use("/api/qualification", require("./routes/qualification.routes")); 
app.use("/api/clinic", require("./routes/clinic.routes"));
app.use("/api/categories",require("./routes/serviceCategory.routes"))
app.use("/api/services",require("./routes/providerService.routes"))
app.use("/api/offers",require("./routes/offer.routes"));
app.use("/api/serviceRequest",require("./routes/ServiceRequest.routes"))
app.use("/api/appointments",require("./routes/appointment.routes"));
app.use("/api/medical-history", require("./routes/medicalHistory.route"));
app.use("/api/patient-general-info", require("./routes/patientGeneralInfo.routes"));
app.use("/api/service-bookings", require("./routes/serviceBooking.routes"));
app.use("/api/cities", require("./routes/city.routes"));
app.use("/api/specialties",require("./routes/specialty.routes"));
app.use("/api/admin",require("./routes/admin.routes"));
app.use("/api/notification", require("./routes/notification.routes"));
app.use("/api/reviews", require("./routes/review.routes"));
app.use("/api/complaints", require("./routes/complain.route"));


app.use("/", (req, res) => {
  res.send("API is working ✅");
});


server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


