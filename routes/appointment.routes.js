const express = require("express");
const router = express.Router();
const validateToken = require('../middleware/validateToken');
const appointment = require("../controllers/appointment.controller");

router.get("/provider",validateToken,appointment.getAppointmentsByProvider);

router.get("/client",validateToken,appointment.getAppointmentsByClient);

router.patch("/:id/session",validateToken,appointment.updateSessionDetails);
router.patch("/:id/cancel",validateToken,appointment.cancelAppointment);

router.patch("/:id/start",validateToken,appointment.startAppointment);
router.patch("/:id/end",validateToken,appointment.endAppointment);
router.patch("/:id/followup",validateToken,appointment.bookFollowUp);

router.get("/getPatientForProvider",validateToken,appointment.getAllPatientsForProvider);
router.get("/getAppointmentsForProviderClient/:providerId/:clientId",validateToken,appointment.getAllAppointmentsForProviderAndClient);

router.get("/getPatientForProvider/:clientId",validateToken,appointment.getPatientForProvider);


router.get("/dashboard",validateToken,appointment.getAppointmentsForDashboard);
router.get("/dashboard/metrics",validateToken,appointment.getMetrics);

router.get("/getLastTwoAppointments",validateToken,appointment.getLastTwoAppointments)


module.exports = router;










