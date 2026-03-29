/**
 * Seed batches and courses. Run: node seed/seedBatchesCourses.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const Batch = require("../models/Batch");
const Course = require("../models/Course");

const batchData = [
  { name: "Web101", slug: "web101", description: "Web development batch - January 2026", startDate: new Date("2026-01-01") },
  { name: "Web201", slug: "web201", description: "Advanced web batch - February 2026", startDate: new Date("2026-02-01") },
  { name: "React Batch", slug: "react", description: "React focused batch", startDate: new Date("2026-01-15") },
  { name: "DSA Batch", slug: "dsa", description: "Data Structures & Algorithms batch", startDate: new Date("2026-01-15") },
];

const courseData = [
  { batchSlug: "react", slug: "basic-react", title: "Basic React", description: "Modern front-end development using React, hooks, and component-based architecture.", order: 0 },
  { batchSlug: "react", slug: "advance-react", title: "Advance React", description: "Advanced React patterns, performance, and state management.", order: 1 },
  { batchSlug: "dsa", slug: "dsa-fundamentals", title: "DSA Fundamentals", description: "Problem-solving course covering core data structures and algorithmic thinking.", order: 0 },
];

async function seed() {
  await connectDB();

  for (const b of batchData) {
    await Batch.findOneAndUpdate(
      { slug: b.slug },
      { $set: b },
      { upsert: true, new: true }
    );
  }

  const batches = await Batch.find();
  const batchBySlug = Object.fromEntries(batches.map((b) => [b.slug, b._id]));

  for (const c of courseData) {
    const batchId = batchBySlug[c.batchSlug];
    if (!batchId) continue;
    await Course.findOneAndUpdate(
      { batch: batchId, slug: c.slug },
      { $set: { batch: batchId, title: c.title, slug: c.slug, description: c.description, order: c.order } },
      { upsert: true }
    );
  }

  console.log("Batches and courses seeded.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
