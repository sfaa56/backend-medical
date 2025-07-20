const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');

const validateToken = asyncHandler(async (req, res, next) => {
    let token;
    let authHeader = req.headers.Authorization || req.headers.authorization;

    // 1. Check Authorization header
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
    }

    console.log(
        "sestion",req.cookies
    )
    // 2. If not in header, check cookies
    if (!token && req.cookies && req.cookies.session) {
        token = req.cookies.session;
    }

    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.log(err);
                res.status(401).json({ message: "User is not authorized" });
                return;
            }
            console.log("decoded",decoded);
            req.user = decoded;
            next();
        });
    } else {
        res.status(401).json({ message: "Token is missing or malformed" });
    }
});

module.exports = validateToken;