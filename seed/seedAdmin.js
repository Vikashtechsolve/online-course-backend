require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const existingSuperAdmin = await User.findOne({ role: "superadmin" });

    if (existingSuperAdmin) {
      console.log("Super Admin already exists:");
      console.log(`  Email: ${existingSuperAdmin.email}`);
      console.log("  Skipping seed.");
      process.exit(0);
    }

    const superAdmin = await User.create({
      name: process.env.SUPER_ADMIN_NAME || "Super Admin",
      email: (process.env.SUPER_ADMIN_EMAIL || "admin@vts.com").toLowerCase(),
      password: process.env.SUPER_ADMIN_PASSWORD || "admin123",
      phone: "",
      role: "superadmin",
      isActive: true,
    });

    console.log("Super Admin created successfully:");
    console.log(`  Name:  ${superAdmin.name}`);
    console.log(`  Email: ${superAdmin.email}`);
    console.log(`  Role:  ${superAdmin.role}`);
    console.log("");

    // Create a demo student for testing
    const existingStudent = await User.findOne({ email: "student@vts.com" });
    if (!existingStudent) {
      const student = await User.create({
        name: "Priyanka",
        email: "student@vts.com",
        password: "student123",
        phone: "+91 9876543210",
        role: "student",
        isActive: true,
        createdBy: superAdmin._id,
      });

      console.log("Demo Student created:");
      console.log(`  Name:  ${student.name}`);
      console.log(`  Email: ${student.email}`);
      console.log(`  Pass:  student123`);
    }

    console.log("\nSeed completed.");
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
}

seedAdmin();
