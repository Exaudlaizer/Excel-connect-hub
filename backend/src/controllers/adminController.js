const Ad = require("../models/Ad");
const Application = require("../models/Application");
const Course = require("../models/Course");
const Job = require("../models/Job");
const User = require("../models/User");

async function analytics(_req, res, next) {
  try {
    const [users, students, companies, mentors, jobs, applications, ads, courses, pendingJobs, pendingAds, pendingCourses] =
      await Promise.all([
        User.count(),
        User.count({ where: { role: "student" } }),
        User.count({ where: { role: "company" } }),
        User.count({ where: { role: "mentor" } }),
        Job.count(),
        Application.count(),
        Ad.count(),
        Course.count(),
        Job.count({ where: { status: "pending" } }),
        Ad.count({ where: { status: "pending" } }),
        Course.count({ where: { status: "pending" } })
      ]);

    res.json({
      analytics: {
        users,
        students,
        companies,
        mentors,
        jobs,
        applications,
        ads,
        courses,
        pendingApprovals: pendingJobs + pendingAds + pendingCourses
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { analytics };
