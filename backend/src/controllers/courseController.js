const Course = require("../models/Course");
const User = require("../models/User");

async function listCourses(req, res, next) {
  try {
    const where = {};
    if (req.query.category) where.category = req.query.category;
    if (req.query.status) where.status = req.query.status;
    if (!req.user || req.user.role === "student") where.status = "approved";

    const courses = await Course.findAll({
      where,
      include: [{ model: User, as: "provider", attributes: ["id", "name", "companyProfile"] }],
      order: [["createdAt", "DESC"]]
    });
    res.json({ courses });
  } catch (error) {
    next(error);
  }
}

async function createCourse(req, res, next) {
  try {
    const course = await Course.create({
      ...req.body,
      providerId: req.user.id,
      status: req.user.role === "admin" ? "approved" : "pending"
    });
    res.status(201).json({ course });
  } catch (error) {
    next(error);
  }
}

async function enrollCourse(req, res, next) {
  try {
    const course = await Course.findOne({ where: { id: req.params.id, status: "approved" } });

    if (!course) return res.status(404).json({ message: "Course not found" });
    const enrolledStudents = Array.from(new Set([...(course.enrolledStudents || []), req.user.id]));
    await course.update({ enrolledStudents });
    res.json({ course });
  } catch (error) {
    next(error);
  }
}

async function updateCourseStatus(req, res, next) {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    await course.update({ status: req.body.status });
    res.json({ course });
  } catch (error) {
    next(error);
  }
}

module.exports = { listCourses, createCourse, enrollCourse, updateCourseStatus };
