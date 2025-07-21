// index.js
const express = require("express");
const connectDb = require("./config/dbConnection");
const dotenv = require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 5000;
const cookieParser = require("cookie-parser");
const cors = require('cors');


connectDb();

app.use(cors({
  origin:process.env.front_url, // frontend
  credentials: true,
}));

app.use(cookieParser());

app.use(express.json());


app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/user"));
app.use("/api/cities", require("./routes/city.routes"));
app.use("/api/specialties",require("./routes/specialty.routes"));
app.use("/api/admin",require("./routes/admin.routes"));

app.use("/", (req, res) => {
  res.send("API is working ✅");
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


