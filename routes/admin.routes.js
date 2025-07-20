
const express = require('express');

const { verifyUser,getOverviewStats,toggleBanStatus } = require('../controllers/admin.controller');
const validateToken = require('../middleware/validateToken');

const router = express.Router();

router.put('/approve-provider/:id',validateToken,verifyUser);
router.get('/overview', validateToken,getOverviewStats);
router.get('/ban-user/:id', validateToken,toggleBanStatus);



module.exports = router;