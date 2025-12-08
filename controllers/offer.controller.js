const Offer = require("../models/Offer");

const joi = require("joi");
const ServiceRequest = require("../models/ServiceRequest");
const Appointment = require("../models/Appointment");
const { populate } = require("../models/User");
const { sendNotification } = require("../utils/notify");

const offerSchema = joi.object({
  serviceRequestId: joi.string().required(),
  message: joi.string(),
  price: joi.number().required(),
  date: joi.date().required(),
  place: joi.string().required(),
});

exports.createOffer = async (req, res) => {
  try {
    // Validate request body
    const { error } = offerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const providerId = req.user?.id;
    const { serviceRequestId } = req.body;

    if (!serviceRequestId) {
      return res.status(400).json({ error: "serviceRequestId is required" });
    }

    // Check if service request exists
    const serviceRequest = await ServiceRequest.findById(serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).json({ error: "Service request not found" });
    }

    // Check if offer already exists for this provider & request
    const existingOffer = await Offer.findOne({ serviceRequestId, providerId });
    if (existingOffer) {
      return res
        .status(400)
        .json({ error: "You have already created an offer for this request" });
    }

    // Create new offer
    const offer = new Offer({ ...req.body, providerId });
    const savedOffer = await offer.save();

    // Add offer to the service request
    serviceRequest.offers.push(savedOffer._id);
    await serviceRequest.save();


        // Notify client about new offer
    await sendNotification({
      recipientId: serviceRequest.clientId,
      senderId: providerId,
      type: "offer_received",
      message: `You received a new offer for your service request`,
      relatedId: serviceRequest._id,
      io: req.io
    });

    res.status(201).json(savedOffer);
  } catch (err) {
    console.error("Error creating offer:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

exports.getAllOffers = async (req, res) => {
  try {
    const offers = await Offer.find().populate("serviceRequestId providerId");
    res.status(200).json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOfferById = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).populate(
      "serviceRequestId providerId"
    );
    if (!offer) return res.status(404).json({ message: "Offer not found" });
    res.status(200).json(offer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.acceptOffer = async (req, res) => {
  const { offerId } = req.params;

  try {
    const offer = await Offer.findById(offerId).populate({
      path: "serviceRequestId",
      populate: {
        path: "postalCode",
        populate: { path: "district", populate: { path: "city" } },
      },
    });

    if (!offer) return res.status(404).json({ message: "Offer not found" });

    console.log(
      "offer.serviceRequestId.clientId",
      offer.serviceRequestId.clientId,
      "req.user.id",
      req.user.id
    );

    if (
      offer?.serviceRequestId?.clientId?.toString() !==
      req?.user?.id?.toString()
    ) {
      return res.status(400).json({ message: "Not authorized for this offer" });
    }

    const requestId = offer.serviceRequestId._id;

    await Offer.updateMany(
      { serviceRequestId: requestId, _id: { $ne: offerId } },
      { $set: { status: "rejected" } }
    );

    offer.status = "accepted";
    await offer.save();

    await Appointment.create({
      offerId: offer._id,
      serviceRequestId: offer.serviceRequestId._id,
      subCategoryId: offer.serviceRequestId.subCategory,
      subSpecialtyId: offer.serviceRequestId.subSpecialty,
      providerId: offer.providerId,
      clientId: offer.serviceRequestId.clientId,
      date: offer.date,
      place: offer.place,
      address: offer.serviceRequestId.postalCode,
      status: "upcoming",
    });

        // Notify provider about offer acceptance
    await sendNotification({
      recipientId: offer.providerId,
      senderId: req.user.id,
      type: "offer_accepted",
      message: `Your offer has been accepted! An appointment has been scheduled.`,
      relatedId: offer.serviceRequestId._id,
      io: req.io
    });

        // Notify other providers about offer rejection
    const rejectedOffers = await Offer.find({
      serviceRequestId: offer.serviceRequestId._id,
      _id: { $ne: offerId },
      status: "rejected"
    });

    for (const rejectedOffer of rejectedOffers) {
      await sendNotification({
        recipientId: rejectedOffer.providerId,
        senderId: req.user.id,
        type: "offer_rejected",
        message: `Your offer for this service request was not accepted`,
        relatedId: rejectedOffer._id,
        io: req.io
      });
    }

    await ServiceRequest.findByIdAndUpdate(requestId, {
      status: "accepted",
      acceptedOffer: offer._id,
      acceptedProvider: offer.providerId,
    });

    res.status(200).json({ message: "Offer accepted successfully", offer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

exports.updateOffer = async (req, res) => {
  try {
    const updatedOffer = await Offer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.status(200).json(updatedOffer);
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

// dont delte but change the flag
exports.deleteOffer = async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) return res.status(404).json({ message: "Offer not found" });

  if (
    !req.user.isAdmin ||
    offer.providerId.toString() !== req.user._id.toString()
  ) {
    return res
      .status(403)
      .json({ message: "You are not authorized to delete this offer" });
  }

  try {
    await Offer.findByIdAndDelete(req.params.id);
    // Also remove offer from associated service request
    await ServiceRequest.findByIdAndUpdate(offer.serviceRequestId, {
      $pull: { offers: offer._id },
    });

    // Notify client about offer withdrawal
    await sendNotification({
      recipientId: offer.serviceRequestId.clientId,
      senderId: req.user.id,
      type: "offer_withdrawn",
      message: `An offer for your service request has been withdrawn`,
      relatedId: offer.serviceRequestId._id,
      io: req.io
    });

    
    res.status(200).json({ message: "Offer deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOffersByProvider = async (req, res) => {
  try {
    const offers = await Offer.find({ providerId: req.user?.id })
      .populate("providerId")
      .populate({
        path: "serviceRequestId",
        populate: [
          { path: "subSpecialty", populate: { path: "specialty" } },
          { path: "subCategory", populate: { path: "category" } },
          {
            path: "postalCode",
            populate: { path: "district", populate: { path: "city" } },
          },
        ],
      })
      .lean();
    res.status(200).json(offers);
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

exports.getOffersByServiceRequest = async (req, res) => {
  try {
    const offers = await Offer.find({
      serviceRequestId: req.params.serviceRequestId,
    }).populate("serviceRequestId providerId");
    res.status(200).json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOffersByClient = async (req, res) => {
  try {
    const offers = await Offer.find({ clientId: req.params.clientId }).populate(
      "serviceRequestId providerId"
    );
    res.status(200).json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
