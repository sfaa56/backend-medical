const express = require("express");

const {loginUser ,registerUser,logoutUser,ChangePassword } = require("../controllers/auth.controller");
const validateToken = require('../middleware/validateToken');


const router =express.Router();


router.post("/register",registerUser);
router.post("/login",loginUser);
router.post("/logout",logoutUser)
router.put("/password",validateToken,ChangePassword)

// router.post("login",loginUser),
// router.post("/forget",forgetPassword)
// router.post("/verify",verifyToken)
// router.post("/resetPassword",resetPassword)
// router.post("/refresh",refreshAccessToken);

module.exports = router;
