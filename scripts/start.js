#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");

console.log("🚀 Starting WhatsApp Sales Bot...\n");

// Run migrations with proper error handling
console.log("📦 Running database migrations...");
try {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
  });
  console.log("✅ Migrations completed successfully!\n");
} catch (error) {
  console.error("❌ Migration failed:", error.message);
  console.error("Continuing anyway - database might already be up to date\n");
}

// Start the server
console.log("🌟 Starting server...\n");
try {
  execSync("node dist/index.js", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
  });
} catch (error) {
  console.error("❌ Server failed to start:", error.message);
  process.exit(1);
}
