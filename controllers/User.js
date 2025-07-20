const Booking = require("../models/Booking");
const Offer = require("../models/Offer");
const Review = require("../models/Review");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const joi = require("joi");

const userValidationSchema = joi.object({
  _id: joi.string().optional(),
  id: joi.string().optional(),
  name: joi.string().min(3).required(),
  email: joi.string().email().required(),
  password: joi.string().min(6).required(),
  phoneNumber: joi.string().required(),
  city: joi.string().optional(),
  region: joi.string().optional(),
  role: joi.string().valid("admin", "user","provider").optional(),
  avatar: joi.string().optional(),
});

const getAllUsers = async (req, res) => {
  
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  const page = parseInt(req.query.page)||1;
  const limit = parseInt(req.query.limit)||10;
  const skip = (page - 1) * limit;

  try {
const users = await User.find({ role: { $ne: "admin" } })
  .populate({ path: "SubSpecialty", select: "name" })
  .select("-password")
  .skip(skip)
  .limit(limit);

    const totalUsers = await User.countDocuments();

    const totalPages = Math.ceil(totalUsers / limit);


    res.status(200).json(users, totalUsers, totalPages, page);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "something went wrong" });
  }
};

const getUserById = async (req, res) => {
  const {id}=req.params;
    try {
    const user = await User.findById(id).select("-password").populate({ path: "SubSpecialty", select: "name" });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const userPicture = async (req, res) => {
  const { imageUrl, publicId } = req.body;

  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if(user&&user.image&&user.image.publicId){
      await cloudinary.uploader.destroy(user.image.publicId)
    }

    user.image.publicId=publicId
    user.image.url= imageUrl
    await user.save();

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: "Update failed" });
  }
};

const updateUser = async (req, res) => {
  const userid = req.params.id;
  const user = req.user;
  console.log("idddddd", userid);
  if (req.user.role !== "admin" && req.user.id !== userid) {
    return res.status(403).json({ message: "Access denied" });
  }
  try {
    const userToUpdate = await User.findById(user.id);

    if (!userToUpdate) {
      res.status(404).json({ message: "User not found" });
      return;
    }


    if (req.body.image.length>0) {
      if (userToUpdate && userToUpdate.image && userToUpdate.image.publicId) {
        await cloudinary.uploader.destroy(userToUpdate.image.publicId);
      }
    }

    Object.assign(userToUpdate, req.body);

    const response = await userToUpdate.save();

    res.status(200).json(response);
  } catch (err) {
    console.log("err", err);
    res
      .status(500)
      .json({ error: "An error occurred while updating the user." });
  }
};

const deleteUser = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete image from Cloudinary if it exists
    if (user.image && user.image.publicId) {
      await cloudinary.uploader.destroy(user.image.publicId);
    }

    // Delete related documents
    await Promise.all([
      Offer.deleteMany({ userId }),
      Booking.deleteMany({ userId }),
      Review.deleteMany({ userId }),
    ]);

    // Delete the user
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  userPicture,
};
