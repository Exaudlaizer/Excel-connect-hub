const Job = require("../models/Job");
const User = require("../models/User");

async function listJobs(req, res, next) {
  try {
    const where = {};
    if (req.query.type) where.type = req.query.type;
    if (req.query.status) where.status = req.query.status;
    if (!req.user || req.user.role === "student") where.status = "approved";

    const jobs = await Job.findAll({
      where,
      include: [{ model: User, as: "company", attributes: ["id", "name", "companyProfile"] }],
      order: [["createdAt", "DESC"]]
    });
    res.json({ jobs });
  } catch (error) {
    next(error);
  }
}

async function createJob(req, res, next) {
  try {
    const job = await Job.create({
      ...req.body,
      companyId: req.user.id,
      status: req.user.role === "admin" ? "approved" : "pending"
    });
    res.status(201).json({ job });
  } catch (error) {
    next(error);
  }
}

async function myJobs(req, res, next) {
  try {
    const jobs = await Job.findAll({ where: { companyId: req.user.id }, order: [["createdAt", "DESC"]] });
    res.json({ jobs });
  } catch (error) {
    next(error);
  }
}

async function updateJob(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const ownsJob = job.companyId === req.user.id;
    if (!ownsJob && req.user.role !== "admin") {
      return res.status(403).json({ message: "Cannot update this listing" });
    }

    await job.update(req.body);
    res.json({ job });
  } catch (error) {
    next(error);
  }
}

async function approveJob(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    await job.update({ status: req.body.status });
    res.json({ job });
  } catch (error) {
    next(error);
  }
}

module.exports = { listJobs, createJob, myJobs, updateJob, approveJob };
