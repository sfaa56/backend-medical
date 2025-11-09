const { default: mongoose } = require("mongoose");
const Complaint = require("../models/complaint");
const User = require("../models/User");
const { sendNotification } = require("../utils/notify");

// CREATE
exports.createComplaint = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.body.sender = req.user.id;

    const complaint = await Complaint.create(req.body);

    const admin = await User.findOne({ role: "admin" }).select("_id");

    if (!admin) {
      return res
        .status(400)
        .json({ success: false, message: "Something went wrong" });
    }
    // Notify client about new offer
    await sendNotification({
      recipientId: admin._id,
      senderId: req.user.id,
      type: "complaint",
      message: `You have a new complaint`,
      relatedId: complaint._id,
      io: req.io,
    });

    return res.status(201).json({ success: true, data: complaint });
  } catch (err) {
    console.error("❌ Create Complaint Error:", err);
    return res
      .status(400)
      .json({ success: false, error: "Something went wrong" });
  }
};

// GET ALL (Admin Only)
// GET ALL with Filters & Search
exports.getAllComplaints = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "You are not allowed" });
    }

    let { type, status, search, page = 1, limit = 10 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const matchStage = {};
    if (type) matchStage.type = type;
    if (status && status !== "All") matchStage.status = status;

    const pipeline = [
      { $match: matchStage },

      // Lookup sender
      {
        $lookup: {
          from: "users",
          localField: "sender",
          foreignField: "_id",
          as: "sender"
        }
      },
      { $unwind: "$sender" },

      // Lookup receiver
      {
        $lookup: {
          from: "users",
          localField: "receiver",
          foreignField: "_id",
          as: "receiver"
        }
      },
      { $unwind: { path: "$receiver", preserveNullAndEmptyArrays: true } },

      // Lookup service
      {
        $lookup: {
          from: "servicerequests",
          localField: "serviceId",
          foreignField: "_id",
          as: "serviceId"
        }
      },
      { $unwind: { path: "$serviceId", preserveNullAndEmptyArrays: true } },
    ];

    // ✅ Apply ALL search after lookup (so names exist)
    if (search && search.trim() !== "") {
      const isObjectId = mongoose.Types.ObjectId.isValid(search);
      pipeline.push({
        $match: {
          $or: [
            { complaintNumber: { $regex: search, $options: "i" } },
            ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(search) }] : []),
            { "sender.firstName": { $regex: search, $options: "i" } },
            { "sender.lastName": { $regex: search, $options: "i" } },
            { "receiver.firstName": { $regex: search, $options: "i" } },
            { "receiver.lastName": { $regex: search, $options: "i" } },
          ]
        }
      });
    }

    const totalComplaints = (await Complaint.aggregate([...pipeline])).length;

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit });

    const complaints = await Complaint.aggregate(pipeline);

    return res.json({
      success: true,
      data: complaints,
      meta: {
        page,
        limit,
        total: totalComplaints,
        totalPages: Math.ceil(totalComplaints / limit),
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};




// GET ONE
exports.getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate("sender")
      .populate("receiver")
      .populate("serviceId");

    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }

    return res.json({ success: true, data: complaint });
  } catch (err) {
    console.error("❌ Get Complaint Error:", err);
    return res
      .status(404)
      .json({ success: false, error: "Something went wrong" });
  }
};

// UPDATE (Admin Only)
exports.updateComplaint = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "You are not allowed" });
    }

    const updated = await Complaint.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    const admin = await User.findOne({ role: "admin" }).select("_id");

    if (!admin) {
      return res
        .status(400)
        .json({ success: false, message: "Something went wrong" });
    }

    // Notify client about new offer
    await sendNotification({
      recipientId: updated.sender,
      senderId: admin._id,
      type: "complaint",
      message: `your complaint is ${updated.status} ${updated.officialResponse || ""}`,
      relatedId: updated.serviceId,
      io: req.io,
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ Update Complaint Error:", err);
    return res
      .status(400)
      .json({ success: false, error: "Something went wrong" });
  }
};
