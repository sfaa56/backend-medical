const ServiceBookingRequest = require("../models/BookingRequest");
const Appointment = require("../models/Appointment");
const ProviderService = require("../models/ProviderService");

const { sendNotification } = require("../utils/notify");

// ✅ Client creates a new booking request
exports.createBookingRequest = async (req, res) => {
  try {
    console.log("req.body", req.body);
    const { serviceId, date, time, city, address, notes, place } = req.body;

    const service = await ProviderService.findById(serviceId).populate(
      "providerId"
    );
    if (!service) return res.status(404).json({ message: "Service not found" });

    if (!req.user || req.user.role !== "client") {
      return res
        .status(403)
        .json({ message: "Only clients can create booking requests" });
    }

    const isAlreadyApplied = await ServiceBookingRequest.findOne({
      serviceId,
      clientId: req.user.id,
      status: { $in: ["pending", "accepted"] }, // ✅ Only these statuses
    });

    if (isAlreadyApplied) {
      return res.status(400).json({ message: "You already applied" });
    }

    // لو الخدمة مش atHome، مفيش داعي للـ address fields
    const booking = new ServiceBookingRequest({
      serviceId,
      providerId: service.providerId._id,
      clientId: req.user.id,
      city,
      address,
      notes,
      place,
      date,
      time,
    });

    const savedBooking = await booking.save();

    // ✅ Link bookingId to the provider service
    service.bookings.push({
      bookingId: savedBooking._id,
      clientId: req.user.id,
      status: "pending",
    });

    await service.save();

    await sendNotification({
      recipientId: service.providerId._id,
      senderId: req.user.id,
      type: "booking_created",
      message: `requeste your service ${service.title}.`,
      relatedId: booking._id,
    });

   

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// ✅ Provider: Get all booking requests for his services
exports.getBookingsForProvider = async (req, res) => {
  try {
    const providerId = req.user.id;
    if (req.user.role !== "provider") {
      return res
        .status(403)
        .json({ message: "Only providers can access their booking requests" });
    }
    const bookings = await ServiceBookingRequest.find({ providerId })
      .populate(
        "clientId serviceId",
        "subServiceCategory title image role firstName lastName email phone name price place"
      )
      .populate({
        path: "serviceId",
        populate: {
          path: "subServiceCategory",
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Provider: Accept a booking request (creates appointment)
exports.acceptBookingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await ServiceBookingRequest.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.providerId.toString() !== req.user.id.toString())
      return res.status(403).json({ message: "Not authorized" });

    booking.status = "accepted";
    await booking.save();

    const service = await ProviderService.findById(booking.serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });

    const appointment = await Appointment.create({
      serviceId: booking.serviceId,
      serviceBookingId: booking._id,
      providerId: booking.providerId,
      clientId: booking.clientId,
      date: booking.date,
      time: booking.time,
      place: booking.place,
      address: booking.address + booking.city,
      status: "upcoming",
    });

    const idx = service.bookings.findIndex(
      (b) => b.bookingId?.toString() === booking._id.toString()
    );

    if (idx !== -1) {
      service.bookings[idx].status = "accepted";
      await service.save();
    }

    await sendNotification({
      recipientId: booking.clientId,
      senderId: req.user.id,
      type: "booking_accepted",
      message: `Your booking for ${service.title} was accepted.`,
      relatedId: booking._id,
    });

    res.status(200).json({ success: true, data: booking._id });
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Provider: Reject a booking
exports.rejectBookingRequest = async (req, res) => {
  try {
    const booking = await ServiceBookingRequest.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Not found" });

    if (booking.providerId.toString() !== req.user.id.toString())
      return res.status(403).json({ message: "Not authorized" });

    if (booking.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Only pending bookings can be cancelled" });
    }

    const service = await ProviderService.findById(booking.serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });

    booking.status = "rejected";
    await booking.save();

    const idx = service.bookings.findIndex(
      (b) => b.bookingId?.toString() === booking._id.toString()
    );

    if (idx !== -1) {
      service.bookings[idx].status = "rejected";
      await service.save();
    }


    
      await sendNotification({
      recipientId: booking.clientId,
      senderId: req.user.id,
      type: "booking_rejected",
      message: `${req.user.name} reject booking ${service.title}.`,
      relatedId: booking._id,
    });

    res.status(200).json({ success: true, data: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Client: Update a pending booking request
exports.updateBookingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await ServiceBookingRequest.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Only the owner can update
    if (booking.clientId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to edit this booking" });
    }

    // Cannot update if already accepted/rejected
    if (booking.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Cannot update a processed booking" });
    }

    const allowedFields = ["date", "time", "city", "address", "notes"];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) booking[field] = req.body[field];
    });

    await booking.save();


      await sendNotification({
      recipientId: booking.providerId,
      senderId: req.user.id,
      type: "booking_updated",
      message: `${req.user.name} update booking ${service.title}.`,
      relatedId: booking._id,
    });

    res
      .status(200)
      .json({ success: true, message: "Booking updated", data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Client: Cancel a pending booking request
exports.cancelBookingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await ServiceBookingRequest.findById(id).populate();
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Only the owner can cancel
    if (booking.clientId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to cancel this booking" });
    }

    if (booking.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Only pending bookings can be cancelled" });
    }

    const service = await ProviderService.findById(booking.serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });

    booking.status = "cancelled";
    await booking.save();

    const idx = service.bookings.findIndex(
      (b) => b.bookingId?.toString() === booking._id.toString()
    );

    if (idx !== -1) {
      service.bookings[idx].status = "cancelled";
      await service.save();
    }

      await sendNotification({
      recipientId: service.providerId,
      senderId: req.user.id,
      type: "booking_cancelled",
      message: `${req.user.name} cancel booking ${service.title}.`,
      relatedId: booking._id,
    });

    res.status(200).json({ success: true, data: id });
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// ✅ Client: Get all their own booking requests
exports.getBookingsForClient = async (req, res) => {
  try {
    const clientId = req.user.id;

    const bookings = await ServiceBookingRequest.find({ clientId })
      .populate(
        "providerId serviceId",
        "subServiceCategory title image role firstName lastName email phone name price place"
      )
      .populate({
        path: "serviceId",
        populate: {
          path: "subServiceCategory",
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const bookings = await ServiceBookingRequest.findById(id)
      // populate provider
      .populate({
        path: "providerId",
        select:
          "title image firstName lastName email phone name price place gender dateOfBirth role",
        populate: {
          path: "postalCode",
          populate: {
            path: "district",
            populate: {
              path: "city",
            },
          },
        },
      })

      // populate client (only needed fields)
      .populate({
        path: "clientId",
        select:
          "title image firstName lastName email phone name price place gender dateOfBirth role",
        populate: {
          path: "postalCode",
          populate: {
            path: "district",
            populate: {
              path: "city",
            },
          },
        },
      })

      // populate service with nested subServiceCategory
      .populate({
        path: "serviceId",
        populate: {
          path: "subServiceCategory",
          select: "name",
        },
      });

    res.status(200).json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
