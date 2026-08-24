/**
 * Removes uploaded files that nothing in the database points at.
 *
 * Cleanup on delete and replace handles the normal path; this catches what
 * escapes it — a file uploaded into a form the user then abandoned, or rows
 * removed by a cascade rather than by the controller.
 *
 * Files newer than the grace period are always kept: a form that is open right
 * now has an uploaded image which is not referenced by anything yet, and
 * deleting it out from under the user would be its own bug.
 *
 * Usage:
 *   npm run uploads:prune            list what would be removed
 *   npm run uploads:prune -- --apply actually remove them
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { sequelize } = require("../config/db");
const Ad = require("../models/Ad");
const { UPLOAD_DIR, localFilename } = require("../controllers/uploadController");

const APPLY = process.argv.includes("--apply");
const GRACE_MINUTES = Number(process.env.UPLOAD_GRACE_MINUTES || 120);

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function referencedFilenames() {
  const referenced = new Set();

  // Every column anywhere in the schema that can hold an upload URL. Adding a
  // new image field means adding it here, or its files become prune targets.
  const ads = await Ad.findAll({ attributes: ["imageUrl", "logoUrl"] });
  for (const ad of ads) {
    for (const url of [ad.imageUrl, ad.logoUrl]) {
      const name = localFilename(url);
      if (name) referenced.add(name);
    }
  }

  return referenced;
}

async function run() {
  await sequelize.authenticate();

  if (!fs.existsSync(UPLOAD_DIR)) {
    console.log("No uploads directory yet — nothing to do.");
    return;
  }

  const referenced = await referencedFilenames();
  const cutoff = Date.now() - GRACE_MINUTES * 60 * 1000;

  const files = fs.readdirSync(UPLOAD_DIR);
  const orphans = [];
  let keptRecent = 0;

  for (const name of files) {
    if (referenced.has(name)) continue;

    const full = path.join(UPLOAD_DIR, name);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;

    if (stat.mtimeMs > cutoff) {
      keptRecent += 1;
      continue;
    }

    orphans.push({ name, size: stat.size });
  }

  console.log(`Scanned ${files.length} file(s) in ${UPLOAD_DIR}`);
  console.log(`  referenced: ${referenced.size}`);
  console.log(`  within the ${GRACE_MINUTES} minute grace period: ${keptRecent}`);
  console.log(`  unreferenced: ${orphans.length}`);

  if (!orphans.length) {
    console.log("\nNothing to prune.");
    return;
  }

  const total = orphans.reduce((sum, file) => sum + file.size, 0);
  orphans.forEach((file) => console.log(`    ${APPLY ? "removing" : "would remove"} ${file.name}  ${formatSize(file.size)}`));
  console.log(`\n${APPLY ? "Reclaimed" : "Would reclaim"} ${formatSize(total)}`);

  if (!APPLY) {
    console.log("\nRe-run with --apply to delete them.");
    return;
  }

  let removed = 0;
  for (const file of orphans) {
    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, file.name));
      removed += 1;
    } catch (error) {
      console.error(`  could not remove ${file.name}: ${error.message}`);
    }
  }
  console.log(`Removed ${removed} file(s).`);
}

run()
  .then(() => sequelize.close())
  .catch(async (error) => {
    console.error("Prune failed:", error.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  });
