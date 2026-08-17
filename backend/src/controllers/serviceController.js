const Service = require("../models/Service");

const EDITABLE_FIELDS = [
  "name",
  "category",
  "description",
  "provider",
  "location",
  "contactEmail",
  "contactPhone",
  "url",
  "status"
];

async function listServices(req, res, next) {
  try {
    const where = {};
    if (req.query.category) where.category = req.query.category;

    // Archived entries stay in the database for the admin who curates them, but
    // never reach students.
    if (req.user?.role === "admin") {
      if (req.query.status) where.status = req.query.status;
    } else {
      where.status = "active";
    }

    const services = await Service.findAll({ where, order: [["name", "ASC"]] });
    res.json({ services });
  } catch (error) {
    next(error);
  }
}

async function createService(req, res, next) {
  try {
    const payload = { createdById: req.user.id };
    EDITABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) payload[field] = req.body[field];
    });

    const service = await Service.create(payload);
    res.status(201).json({ service });
  } catch (error) {
    next(error);
  }
}

async function updateService(req, res, next) {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });

    const updates = {};
    EDITABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    await service.update(updates);
    res.json({ service });
  } catch (error) {
    next(error);
  }
}

async function deleteService(req, res, next) {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });

    await service.destroy();
    res.json({ message: "Service removed" });
  } catch (error) {
    next(error);
  }
}

module.exports = { listServices, createService, updateService, deleteService };
