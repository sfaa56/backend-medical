const express = require("express");
const router = express.Router();
const validateToken = require("../middleware/validateToken");

const {
  getHistoryByClient,
  getAllPrescriptionsByClient,
  getAllLabOrdersByClient,
  addPrescription,
  addLabOrder,
  uploadLabResult,
  getVitalsByClient,
  getPrescriptionsByClientForProvider,
  getLabOrdersByClientForProvider,
  editPrescription,
  deletePrescription,
  getLastVitals
} = require("../controllers/medicalHistoryRecord.controller");

// ✅ Get all history (client)
router.get("/", validateToken, getHistoryByClient);

// ✅ Get prescriptions (flattened for prescriptions tab)
router.get("/prescriptions", validateToken, getAllPrescriptionsByClient);

// ✅ Get lab orders (flattened for lab tab)
router.get("/lab-orders", validateToken, getAllLabOrdersByClient);

// ✅ Provider adds prescription (post appointment)
router.patch(
  "/:clientId/add-prescription",
  validateToken,
  addPrescription
);

// ✅ Provider edits a prescription
router.patch("/:recordId/prescription/:prescriptionId", validateToken ,editPrescription);

// ✅ Provider deletes a prescription
router.delete(
  "/:recordId/prescription/:prescriptionId",
  validateToken,
  deletePrescription
);



// ✅ Provider adds lab order
router.patch(
  "/:clientId/add-lab-order",
  validateToken,
  addLabOrder
);

// ✅ Client uploads lab result
router.patch("/:recordId/lab/:labId/upload", validateToken, uploadLabResult);

// get vitals  by client id
router.get("/vitals", validateToken, getVitalsByClient);


// getPrescriptionsByClientForProvider
router.get("/getPrescriptionsForProvider/:clientId",validateToken,getPrescriptionsByClientForProvider);

// getLabOrdersByClientForProvider
router.get("/getLabOrdersForProvider/:clientId",validateToken,getLabOrdersByClientForProvider);


// getLastVitals
router.get("/getLastVitals",validateToken,getLastVitals)




module.exports = router;
