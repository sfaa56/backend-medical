const express = require("express");
const { get } = require("mongoose");
const {
    updateUser,
    deleteUser,
    getAllUsers,
    getUserById,
    userPicture,
    } = require("../controllers/User");
const validateToken = require("../middleware/validateToken");
    
const router = express.Router();



router.get('/',validateToken,getAllUsers);
router.get('/:id',validateToken,getUserById);
router.put('/:id',validateToken,updateUser);
router.put("/picture/upload",validateToken,userPicture)
router.delete('/:id',validateToken,deleteUser);

module.exports = router;
