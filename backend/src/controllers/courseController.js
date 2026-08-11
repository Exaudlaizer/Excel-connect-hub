const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const Course = require("../models/Course");
const User = require("../models/User");

async function listCourses(req, res, next) {
  try {
    const where = {};
    if (req.query.category) where.category = req.query.category;

    // Visitors and learners only ever see approved courses. A mentor also sees
    // their own drafts, so a course does not vanish while awaiting approval.
    // Admins see everything, including the moderation queue.
    if (req.user?.role === "admin") {
      if (req.query.status) where.status = req.query.status;
    } else if (req.user?.role === "mentor") {
      where[Op.and] = [
        { [Op.or]: [{ status: "approved" }, { providerId: req.user.id }] },
        ...(req.query.status ? [{ status: req.query.status }] : [])
      ];
    } else {
      where.status = "approved";
    }

    const courses = await Course.findAll({
      where,
      include: [{ model: User, as: "provider", attributes: ["id", "name", "mentorProfile"] }],
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

// The roster is another student's personal data, so it never leaves the server.
// Callers get the course plus their own enrolment state.
function publicCourse(course, viewerId) {
  const values = course.toJSON();
  const roster = values.enrolledStudents || [];
  delete values.enrolledStudents;
  return { ...values, enrolledCount: roster.length, isEnrolled: roster.includes(viewerId) };
}

async function enrollCourse(req, res, next) {
  try {
    const course = await Course.findOne({ where: { id: req.params.id, status: "approved" } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    if ((course.enrolledStudents || []).includes(req.user.id)) {
      return res.status(200).json({ course: publicCourse(course, req.user.id), alreadyEnrolled: true });
    }

    // Appending in SQL rather than read-modify-write: two students enrolling at
    // the same moment would otherwise each save a list missing the other.
    // array_append is skipped when the id is already present, so it is safe to
    // retry. `returning` gives back the row as the database now holds it.
    const [, [updated]] = await Course.update(
      {
        enrolledStudents: sequelize.fn(
          "array_append",
          sequelize.col("enrolledStudents"),
          sequelize.cast(req.user.id, "uuid")
        )
      },
      {
        where: {
          id: course.id,
          status: "approved",
          [Op.not]: { enrolledStudents: { [Op.contains]: [req.user.id] } }
        },
        returning: true
      }
    );

    res.json({ course: publicCourse(updated || course, req.user.id) });
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
