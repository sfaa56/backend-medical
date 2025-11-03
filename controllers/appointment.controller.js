const Appointment = require("../models/Appointment");
const MedicalHistory = require("../models/MedicalHistory");
const Offer = require("../models/Offer");
const ServiceRequest = require("../models/ServiceRequest");
const ServiceBookingRequest = require("../models/BookingRequest");
const ProviderService = require("../models/ProviderService");
const Joi = require("joi");
const { sendNotification } = require("../utils/notify");

const appointmentSchema = Joi.object({
  offerId: Joi.string().required(),
  serviceRequestId: Joi.string().required(),
  providerId: Joi.string().required(),
  clientId: Joi.string().required(),
  date: Joi.date().required(),
  place: Joi.string().required(),
});

// ✅ Create appointment (usually called after accepting an offer)
exports.createAppointment = async (req, res) => {
  try {
    const { error } = appointmentSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const existing = await Appointment.findOne({ offerId: req.body.offerId });
    if (existing) {
      return res.status(400).json({ message: "Appointmet already exists" });
    }

    const appointment = new Appointment(req.body);
    const saved = appointment.save();

    res.status(201).json({ message: "Appointment created", data: saved });
  } catch (error) {
    console.error("error", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// ✅ Get all appointments (admin)
exports.getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find().populate(
      "providerId clientId serviceRequestId offerId"
    );
    res.status(200).json({ success: true, data: appointments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Get provider appointments (doctor)
exports.getAppointmentsByProvider = async (req, res) => {
  try {
    const providerId = req.user.id;
    const appointments = await Appointment.find({ providerId })
      // for offer flow
      .populate("offerId") // populate العادي
      .populate({
        path: "serviceRequestId",
        populate: {
          path: "subCategory", // هنا الـ field اللي جوه serviceRequestId
          populate: { path: "category" }, // هنا الـ field اللي جوه subCategory
        },
      })

      .populate({
        path: "clientId",
        populate: {
          path: "postalCode",
          populate: {
            path: "district",
            populate: {
              path: "city", // <-- 3rd level nested
            },
          },
        },
      })
      // for booking flow
      .populate("serviceBookingId")
      .populate({
        path: "serviceId",
        populate: {
          path: "subServiceCategory",
        },
      })

      .lean()
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: appointments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Get client appointments (patient)
exports.getAppointmentsByClient = async (req, res) => {
  try {
    const clientId = req.user.id;

    const appointments = await Appointment.find({ clientId })
      .populate("providerId offerId") // populate العادي
      .populate({
        path: "serviceRequestId",
        populate: {
          path: "subCategory", // هنا الـ field اللي جوه serviceRequestId
          populate: { path: "category" }, // هنا الـ field اللي جوه subCategory
        },
      })

      .populate({
        path: "providerId",
        populate: {
          path: "postalCode",
          populate: {
            path: "district",
            populate: {
              path: "city", // <-- 3rd level nested
            },
          },
        },
      })
      // for booking flow
      .populate("serviceBookingId")
      .populate({
        path: "serviceId",
        populate: {
          path: "subServiceCategory",
        },
      })
      .lean()

      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: appointments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Start Appointment (doctor clicks Start)
exports.startAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Not found" });

    if (appointment.providerId.toString() !== req.user.id.toString())
      return res.status(403).json({ message: "Not authorized" });

    if (appointment.status !== "upcoming")
      return res
        .status(400)
        .json({ message: "Only upcoming appointments can be started" });

    appointment.status = "started";
    await appointment.save();

    await sendNotification({
      recipientId: appointment.clientId,
      senderId: req.user.id,
      type: "appointment_started",
      message: `Your appointment has started`,
      relatedId: appointment._id,
      io: req.io,
    });

    res.status(200).json({ message: "Appointment started", data: appointment });
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ message: "Failed to start session" });
  }
};

// cancel appointment

exports.cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Not found" });

    // ✅ only client or provider can cancel
    const isOwner =
      appointment.clientId.toString() === req.user.id.toString() ||
      appointment.providerId.toString() === req.user.id.toString();

    if (!isOwner) return res.status(403).json({ message: "Not authorized" });

    // ✅ restrict what can be cancelled
    if (!["upcoming", "started"].includes(appointment.status)) {
      return res.status(400).json({
        message: "Only upcoming or started appointments can be cancelled",
      });
    }

    // ✅ mark appointment cancelled
    appointment.status = "cancelled";
    await appointment.save();

    // ✅ Offer-based flow
    if (appointment.offerId) {
      await Promise.all([
        Offer.findByIdAndUpdate(appointment.offerId, { status: "cancelled" }),
        ServiceRequest.findByIdAndUpdate(appointment.serviceRequestId, {
          status: "cancelled",
        }),
      ]);
    }

    // ✅ Booking-based flow
    if (appointment.serviceBookingId) {
      const booking = await ServiceBookingRequest.findByIdAndUpdate(
        appointment.serviceBookingId,
        { status: "cancelled" },
        { new: true }
      );

      if (booking) {
        // ✅ Also update provider service’s embedded booking record
        const service = await ProviderService.findById(booking.serviceId);

        if (service) {
          const bookingIndex = service.bookings.findIndex(
            (b) => b.bookingId?.toString() === booking._id.toString()
          );

          if (bookingIndex !== -1) {
            service.bookings[bookingIndex].status = "cancelled";
            await service.save();
          }
        }
      }
    }

    // Notify other party about cancellation
    const recipientId =
      req.user.id === appointment.clientId.toString()
        ? appointment.providerId
        : appointment.clientId;

    await sendNotification({
      recipientId,
      senderId: req.user.id,
      type: "appointment_cancelled",
      message: `Appointment for ${appointment.date} was cancelled`,
      relatedId: appointment._id,
      io: req.io,
    });

    res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      data: {
        _id: appointment._id,
        status: appointment.status,
        date: appointment.date,
      },
    });
  } catch (err) {
    console.error("❌ cancelAppointment error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// ✅ End Appointment
exports.endAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Not found" });

    if (appointment.providerId.toString() !== req.user.id.toString())
      return res.status(403).json({ message: "Not authorized" });

    // ✅ Only started or upcoming appointments can be ended
    if (appointment.status !== "started") {
      return res
        .status(400)
        .json({ message: "Appointment already completed or cancelled" });
    }

    appointment.status = "completed";
    await appointment.save();

    // ✅ حفظ التفاصيل في MedicalHistory
    await MedicalHistory.create({
      clientId: appointment.clientId,
      providerId: appointment.providerId,
      appointmentId: appointment._id,
      vitals: appointment.sessionDetails.vitals,
      diagnosis: appointment.sessionDetails.diagnosis,
      lapOrders: appointment.sessionDetails.LapOrders,
      prescriptions: appointment.sessionDetails.orders?.map((o) => ({
        ...o,
        createdFrom: "appointment",
      })),
      advice: appointment.sessionDetails.advice,
    });

    // ✅ Offer-based flow
    if (appointment.offerId) {
      await Promise.all([
        Offer.findByIdAndUpdate(appointment.offerId, { status: "completed" }),
        ServiceRequest.findByIdAndUpdate(appointment.serviceRequestId, {
          status: "completed",
        }),
      ]);
    }

    console.log("appointment", appointment);

    // ✅ Booking-based flow
    if (appointment.serviceBookingId) {
      console.log("appointment.serviceBookingId", appointment.serviceBookingId);

      const booking = await ServiceBookingRequest.findByIdAndUpdate(
        appointment.serviceBookingId,
        { status: "completed" },
        { new: true }
      );

      console.log("appointment.serviceBookingId", appointment.serviceBookingId);

      if (booking) {
        console.log("booking", booking);

        const service = await ProviderService.findById(booking.serviceId);

        if (service) {
          const bookingIndex = service.bookings.findIndex(
            (b) => b.bookingId?.toString() === booking._id.toString()
          );

          if (bookingIndex !== -1) {
            service.bookings[bookingIndex].status = "completed";
            await service.save();
          }
        }
      }
    }

    await sendNotification({
      recipientId: appointment.clientId,
      senderId: req.user.id,
      type: "appointment_completed",
      message: `Your appointment has been completed`,
      relatedId: appointment._id,
      io: req.io,
    });

    // ✅ Send notification to client to leave a review
    await sendNotification({
      recipientId: appointment.clientId,
      senderId: req.user.id,
      type: "review_request",
      message: `Your appointment with Dr. ${req?.user?.name} has ended. Please leave a review.`,
      relatedId: appointment._id,
      io: req.io,
    });

    res
      .status(200)
      .json({ message: "Appointment completed", data: appointment });
  } catch (err) {
    console.log("message", message);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Update session details (Vitals, Exam, Diagnosis, Orders, etc.)
exports.updateSessionDetails = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Not found" });

    if (appointment.providerId.toString() !== req.user.id.toString())
      return res.status(403).json({ message: "Not authorized" });

    const {
      temperature,
      pulse,
      height,
      weight,
      appearance,
      consciousness,
      hydration,
      examinationNotes,
      diagnosis,
      orders,
      LapOrders,
      advice,
    } = req.body;

    appointment.sessionDetails = {
      vitals: { temperature, pulse, height, weight },
      generalExam: {
        appearance,
        consciousness,
        hydration,
        notes: examinationNotes,
      },
      diagnosis,
      orders,
      LapOrders,
      advice,
    };

    await appointment.save();

    res
      .status(200)
      .json({ message: "Session details updated", data: appointment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Book follow-up appointment
exports.bookFollowUp = async (req, res) => {
  try {
    const parent = await Appointment.findById(req.params.id);
    if (!parent) return res.status(404).json({ message: "Not found" });
    if (parent.followUpOf) {
      return res
        .status(400)
        .json({ message: "Cannot book follow-up for a follow-up" });
    }

    // ✅ cannot make follow-up for a follow-up appointment
    if (parent.followUpOf) {
      return res
        .status(400)
        .json({ message: "Cannot book follow-up for another follow-up" });
    }

    if (parent.followUpBooked) {
      return res
        .status(400)
        .json({ message: "Follow-up already booked for this appointment" });
    }

    parent.status = "completed";
    parent.followUpBooked = true;
    await parent.save();

    // ✅ حفظ التفاصيل في MedicalHistory
    await MedicalHistory.create({
      clientId: parent.clientId,
      providerId: parent.providerId,
      appointmentId: parent._id,
      vitals: parent.sessionDetails.vitals,
      diagnosis: parent.sessionDetails.diagnosis,
      lapOrders: parent.sessionDetails.LapOrders,
      prescriptions: parent.sessionDetails.orders?.map((o) => ({
        ...o,
        createdFrom: "appointment",
      })),
      advice: parent.sessionDetails.advice,
    });

    const followUp = await Appointment.create({
      followUpOf: parent._id,

      // keep references depending on flow
      offerId: parent.offerId || null,
      serviceRequestId: parent.serviceRequestId || null,
      serviceBookingId: parent.serviceBookingId || null,
      serviceId: parent.serviceId || null,

      providerId: parent.providerId,
      clientId: parent.clientId,
      date: req.body.Data.date,
      time: req.body.Data.time,
      place: parent.place,
      address: parent.address || null,
      status: "upcoming",
    });

    await followUp.save();

    await sendNotification({
      recipientId: followUp.clientId,
      senderId: req.user.id,
      type: "followup_booked",
      message: `Your appointment has been completed`,
      relatedId: followUp._id,
      io: req.io,
    });

    res.status(201).json({
      success: true,
      message: "Follow-up booked successfully",
      data: {
        parentAppointment: parent,
        followUpAppointment: followUp,
      },
    });
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// ✅ Get all patients for a provider
exports.getAllPatientsForProvider = async (req, res) => {
  try {
    const providerId = req.user.id;

    // ✅ كل المواعيد الخاصة بالطبيب مرتبة من الأحدث للأقدم
    const appointments = await Appointment.find({ providerId })
      .populate(
        "clientId",
        "firstName lastName email phone dateOfBirth gender postalCode"
      )
      .populate({
        path: "clientId",
        populate: {
          path: "postalCode",
          populate: {
            path: "district",
            populate: { path: "city" },
          },
        },
      })
      .sort({ date: -1 })
      .lean();

    // ✅ تجميع المرضى بدون تكرار
    const patientsMap = new Map();

    for (const appt of appointments) {
      const client = appt.clientId;
      if (!client) continue; // safety check

      const cid = client._id.toString();

      if (!patientsMap.has(cid)) {
        patientsMap.set(cid, {
          _id: client._id,
          name: `${client.firstName} ${client.lastName}`,
          email: client.email,
          phone: client.phone,
          gender: client.gender,
          dateOfBirth: client.dateOfBirth,
          lastAppointment: appt.date,
          lastStatus: appt.status,
          address: {
            postalCode: client.postalCode?.code || null,
            district: client.postalCode?.district?.name || null,
            city: client.postalCode?.district?.city?.name || null,
          },
        });
      }
    }

    const patients = Array.from(patientsMap.values());

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (err) {
    console.error("Error fetching patients:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// get a patient details for a provider by providerId and clientId
exports.getPatientForProvider = async (req, res) => {
  try {
    const providerId = req.user.id;
    const clientId = req.params.clientId; // expect /.../:clientId

    if (!clientId) {
      return res
        .status(400)
        .json({ success: false, message: "clientId is required in params" });
    }

    const lastAppt = await Appointment.findOne({ providerId, clientId })
      .sort({ date: -1 })
      .populate(
        "clientId",
        "firstName lastName email phone dateOfBirth gender image postalCode"
      )
      .populate({
        path: "clientId",
        populate: {
          path: "postalCode",
          populate: {
            path: "district",
            populate: { path: "city" },
          },
        },
      })
      .lean();

    if (!lastAppt) {
      return res.status(404).json({
        success: false,
        message: "No appointments found for this client",
      });
    }

    // Build a sanitized client object — do NOT send password, roles, flags, or other sensitive fields
    const c = lastAppt.clientId || {};
    const sanitizedClient = {
      _id: c._id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      image: c.image,
      gender: c.gender,
      dateOfBirth: c.dateOfBirth,
      postalCode: c.postalCode
        ? {
            _id: c.postalCode._id,
            code: c.postalCode.code,
            district: c.postalCode.district
              ? {
                  _id: c.postalCode.district._id,
                  name: c.postalCode.district.name,
                  city: c.postalCode.district.city
                    ? {
                        _id: c.postalCode.district.city._id,
                        name: c.postalCode.district.city.name,
                      }
                    : null,
                }
              : null,
          }
        : null,
    };

    return res.status(200).json({
      success: true,
      data: {
        client: sanitizedClient,
        clientId: sanitizedClient._id || clientId,
        lastBookingDate: lastAppt.date,
        lastStatus: lastAppt.status,
      },
    });
  } catch (err) {
    console.error("Error in getPatientForProvider:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
// get all Appointments for both provider and client
exports.getAllAppointmentsForProviderAndClient = async (req, res) => {
  try {
    console.log("req.params", req.params);
    const { clientId } = req.params;
    const { providerId } = req.params;

    console.log("clientId", clientId);
    console.log("providerId", providerId);

    const appointments = await Appointment.find({
      providerId,
      clientId,
    })
      .populate("providerId", "name email") // limit provider fields
      .populate("clientId", "name email") // limit client fields
      .populate("offerId")
      .populate({
        path: "serviceRequestId",
        populate: {
          path: "subCategory",
        },
      })
      // for booking flow
      .populate("serviceBookingId")
      .populate({
        path: "serviceId",
        populate: {
          path: "subServiceCategory",
        },
      }) // keep other as needed
      .lean()

      .sort({ date: -1 });

    console.log("appointmennts", appointments);
    res.status(200).json({ success: true, data: appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAppointmentsForDashboard = async (req, res) => {
  try {
    const providerId = req.user.id;
    const appointments = await Appointment.find({ providerId })
      .populate("offerId", "title status") // only needed fields

      .populate({
        path: "clientId",
        select: "firstName lastName phone image",
      })
      .lean()
      .sort({ createdAt: -1 })
      .limit(10); // limit to latest 10

    res.status(200).json({ success: true, data: appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const mongoose = require("mongoose");

exports.getMetrics = async (req, res) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // last 7 days including today

    // Aggregate appointments by day
    const weeklyAppointmentsRaw = await Appointment.aggregate([
      { $match: { providerId, date: { $gte: sevenDaysAgo, $lte: today } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill missing days
    const weekData = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const found = weeklyAppointmentsRaw.find((item) => item._id === dateStr);
      weekData.push({ date: dateStr, count: found ? found.count : 0 });
    }

    // Total/completed/pending appointments
    const metrics = await Appointment.aggregate([
      { $match: { providerId } },
      {
        $group: {
          _id: null,
          totalAppointments: { $sum: 1 },
          completedAppointments: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalAppointments: 1,
          completedAppointments: 1,
          pendingAppointments: {
            $subtract: ["$totalAppointments", "$completedAppointments"],
          },
        },
      },
    ]);

    res.json({
      weeklyAppointments: weekData,
      totalAppointments: metrics[0]?.totalAppointments || 0,
      completedAppointments: metrics[0]?.completedAppointments || 0,
      pendingAppointments: metrics[0]?.pendingAppointments || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
};

exports.getLastTwoAppointments = async (req, res) => {
  try {
    const clientId = req.user.id;

    // Find the last two appointments for this client
    const appointments = await Appointment.find({ clientId })
      .populate("providerId", "firstName lastName image") // get only provider's name
      .populate({
        path: "serviceId",
        select: "title place subServiceCategory",
        populate: { path: "subServiceCategory", select: "name" },
      })

      .populate({
        path: "serviceRequestId",
        select: "title place subCategory",
        populate: {
          path: "subCategory",
          select: "name",
        },
      })

      .sort({ date: -1, createdAt: -1 }) // latest first
      .limit(2)

      .select("providerId place date time status"); // only needed fields

    if (!appointments.length) {
      return res.status(404).json({ message: "No appointments found" });
    }

    console.log("apt", appointments);

    res.status(200).json({
      success: true,
      appointments: appointments.map((appt) => ({
        firstName: appt.providerId?.firstName || "Unknown",
        lastName: appt.providerId?.lastName || "Unknown",
        iamge: appt.providerId?.image || "Unknown",
        subCategory:appt?.serviceId?.subServiceCategory?.name || appt?.serviceRequestId?.subCategory?.name ,
        place: appt.place,
        date: appt.date,
        time: appt.time,
        status: appt.status,
      })),
    });
  } catch (error) {
    console.error("Error fetching last two appointments:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
