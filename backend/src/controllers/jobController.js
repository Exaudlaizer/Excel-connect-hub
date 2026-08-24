const { Op } = require("sequelize");
const Job = require("../models/Job");
const User = require("../models/User");
const { buildMeta, readPagination } = require("../utils/pagination");

// Content fields a company may set on its own listing. `status` and `companyId`
// are excluded on purpose: spreading req.body into create()/update() would let a
// company approve its own job and skip the admin queue.
const EDITABLE_JOB_FIELDS = [
  "title",
  "type",
  "location",
  "workMode",
  "description",
  "requirements",
  "salaryRange",
  "deadline"
];

function pickJobFields(body) {
  const payload = {};
  EDITABLE_JOB_FIELDS.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });
  return payload;
}

async function listJobs(req, res, next) {
  try {
    const where = {};
    if (req.query.type) where.type = req.query.type;

    const isAdmin = req.user?.role === "admin";

    // Only admins see the moderation queue. A company sees the public listings
    // plus its own drafts; everyone else sees approved listings only. Without
    // this clamp any logged-in company could read every rival's pending post.
    if (isAdmin) {
      if (req.query.status) where.status = req.query.status;
    } else if (req.user?.role === "company") {
      where[Op.and] = [
        { [Op.or]: [{ status: "approved" }, { companyId: req.user.id }] },
        ...(req.query.status ? [{ status: req.query.status }] : [])
      ];
    } else {
      where.status = "approved";
    }

    const { page, limit, offset } = readPagination(req.query);
    // `distinct` so the count reflects jobs, not the rows the join produces.
    const { rows, count } = await Job.findAndCountAll({
      where,
      include: [{ model: User, as: "company", attributes: ["id", "name", "companyProfile"] }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true
    });
    res.json({ jobs: rows, pagination: buildMeta({ page, limit, total: count }) });
  } catch (error) {
    next(error);
  }
}

async function createJob(req, res, next) {
  try {
    const job = await Job.create({
      ...pickJobFields(req.body),
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

// A company may retire its own listing, but only an admin may approve or reject.
const OWNER_STATUS_TRANSITIONS = ["closed"];

async function updateJob(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const isAdmin = req.user.role === "admin";
    const ownsJob = job.companyId === req.user.id;
    if (!ownsJob && !isAdmin) {
      return res.status(403).json({ message: "Cannot update this listing" });
    }

    const updates = pickJobFields(req.body);

    if (req.body.status !== undefined) {
      if (!isAdmin && !OWNER_STATUS_TRANSITIONS.includes(req.body.status)) {
        return res.status(403).json({ message: "Only an admin can change the approval status" });
      }
      updates.status = req.body.status;
    }

    await job.update(updates);
    res.json({ job });
  } catch (error) {
    next(error);
  }
}

async function deleteJob(req, res, next) {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (job.companyId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only remove your own listing" });
    }

    await job.destroy();
    res.json({ message: "Listing removed" });
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

module.exports = { listJobs, createJob, myJobs, updateJob, deleteJob, approveJob };
