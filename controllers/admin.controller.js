const User = require("../models/User");
const Provider = require("../models/ProviderProfile");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");

const getOverviewStats = async (req, res) => {
  try {
    // إجمالي المستخدمين (باستثناء مزودي الخدمة)
    const totalUsers = await User.countDocuments({ role: "user" });

    // إجمالي مزودي الخدمة
    const totalProviders = await Provider.countDocuments();

    // عدد الطلبات حسب الحالة
    const ongoingBookings = await Booking.countDocuments({
      status: "in_progress",
    });
    const completedBookings = await Booking.countDocuments({
      status: "completed",
    });
    const cancelledBookings = await Booking.countDocuments({
      status: "cancelled",
    });

    // الإيرادات الكلية (بافتراض أن لديك حقل commission في Payment)
    const payments = await Payment.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" }, // أو $sum: "$commission"
        },
      },
    ]);

    const totalRevenue = payments[0]?.totalRevenue || 0;

    // نمو المستخدمين (آخر 6 أشهر)
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // نمو الطلبات (آخر 6 أشهر)
    const bookingGrowth = await Booking.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalUsers,
      totalProviders,
      bookings: {
        ongoing: ongoingBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
      },
      totalRevenue,
      userGrowth,
      bookingGrowth,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error getting dashboard data" });
  }
};

const verifyUser = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isVerified = true;
    await user.save();

    res.json({ message: "User verified successfully" });
  } catch (error) {
    console.log("Error verifying user:", error);
    res.status(500).json({ message: "Error verifying user" });
  }
};

const toggleBanStatus = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  const { userId } = req.params;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  user.isBanned = !user.isBanned;
  await user.save();

  res.json({ message: `User is now ${user.isBanned ? "banned" : "unbanned"}` });
};

module.exports = {
  verifyUser,
  getOverviewStats,
  toggleBanStatus,
};
