const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User");

async function createApplication(req, res, next) {
  try {
    const job = await Job.findOne({ where: { id: req.body.job, status: "approved" } });
    if (!job) return res.status(404).json({ message: "Open opportunity not found" });

    const application = await Application.create({
      jobId: req.body.job,
      studentId: req.user.id,
      coverLetter: req.body.coverLetter,
      cvUrl: req.body.cvUrl || req.user.studentProfile?.cvUrl
    });

    res.status(201).json({ application });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "You have already applied to this opportunity" });
    }
    next(error);
  }
}

async function myApplications(req, res, next) {
  try {
    const applications = await Application.findAll({
      where: { studentId: req.user.id },
      include: [
        {
          model: Job,
          as: "job",
          include: [{ model: User, as: "company", attributes: ["id", "name", "companyProfile"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });
    res.json({ applications });
  } catch (error) {
    next(error);
  }
}

async function applicantsForCompany(req, res, next) {
  try {
    const jobs = await Job.findAll({ where: { companyId: req.user.id }, attributes: ["id"] });
    const applications = await Application.findAll({
      where: { jobId: jobs.map((job) => job.id) },
      include: [
        { model: User, as: "student", attributes: ["id", "name", "email", "studentProfile"] },
        { model: Job, as: "job", attributes: ["id", "title", "type", "companyId"] }
      ],
      order: [["createdAt", "DESC"]]
    });
    res.json({ applications });
  } catch (error) {
    next(error);
  }
}

async function updateApplicationStatus(req, res, next) {
  try {
    const application = await Application.findByPk(req.params.id, { include: [{ model: Job, as: "job" }] });
    if (!application) return res.status(404).json({ message: "Application not found" });

    const ownsListing = application.job.companyId === req.user.id;
    if (!ownsListing && req.user.role !== "admin") {
      return res.status(403).json({ message: "Cannot update this application" });
    }

    await application.update({ status: req.body.status });
    res.json({ application });
  } catch (error) {
    next(error);
  }
}

module.exports = { createApplication, myApplications, applicantsForCompany, updateApplicationStatus };
