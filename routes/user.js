const express = require("express");
const { get } = require("mongoose");
const {
    updateUser,
    deleteUser,
    getAllUsers,
    getUserById,
    userPicture,
    toggleAvailability,
    getAllProviders,
    getProviderById,
    getProviderKPI,
    updatePicFromAdmin
    } = require("../controllers/User");
const validateToken = require("../middleware/validateToken");
    
const router = express.Router();


router.get('/providers',getAllProviders);

router.get('/provider/:id',getProviderById);

router.get('/',validateToken,getAllUsers);
router.get('/:id',validateToken,getUserById);
router.put('/:id',validateToken,updateUser);
router.put("/picture/upload",validateToken,userPicture);
router.put("/pictureFromAdmin/upload",validateToken,updatePicFromAdmin);
router.delete('/:id',validateToken,deleteUser);

router.patch("/me/toggle-availability", validateToken, toggleAvailability);

router.get("/DashboardProvider/kpis", validateToken, getProviderKPI);


module.exports = router;
