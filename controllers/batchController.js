const Batch = require("../models/Batch");

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// GET /api/batches — list batches
const getBatches = async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    const batches = await Batch.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ batches });
  } catch (error) {
    console.error("Get batches error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/batches — create batch (admin+)
const createBatch = async (req, res) => {
  try {
    const { name, description, startDate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Batch name is required" });
    }

    const slug = slugify(name.trim());
    const existing = await Batch.findOne({ slug });
    if (existing) {
      return res.status(400).json({ message: "A batch with this name already exists" });
    }

    const batch = await Batch.create({
      name: name.trim(),
      slug,
      description: description?.trim() || "",
      startDate: startDate ? new Date(startDate) : null,
    });

    res.status(201).json({ batch });
  } catch (error) {
    console.error("Create batch error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/batches/:id — supports both ObjectId and slug
const getBatchById = async (req, res) => {
  try {
    const id = req.params.id;
    const isObjectId = /^[a-fA-F0-9]{24}$/.test(id);
    const batch = isObjectId
      ? await Batch.findById(id).lean()
      : await Batch.findOne({ slug: id }).lean();
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }
    res.json({ batch });
  } catch (error) {
    console.error("Get batch error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/batches/:id
const updateBatch = async (req, res) => {
  try {
    const { name, description, startDate, isActive } = req.body;
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (name !== undefined) {
      batch.name = name.trim();
      const slug = slugify(name.trim());
      const existing = await Batch.findOne({ slug, _id: { $ne: batch._id } });
      if (existing) {
        return res.status(400).json({ message: "A batch with this name already exists" });
      }
      batch.slug = slug;
    }
    if (description !== undefined) batch.description = description.trim();
    if (startDate !== undefined) batch.startDate = startDate ? new Date(startDate) : null;
    if (isActive !== undefined) batch.isActive = isActive;

    await batch.save();
    res.json({ batch });
  } catch (error) {
    console.error("Update batch error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/batches/:id (soft - set isActive false)
const deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }
    batch.isActive = false;
    await batch.save();
    res.json({ message: "Batch deactivated successfully" });
  } catch (error) {
    console.error("Delete batch error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getBatches,
  createBatch,
  getBatchById,
  updateBatch,
  deleteBatch,
};
