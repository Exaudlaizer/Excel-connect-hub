/**
 * Upserts the plan catalogue from src/config/billing.js into the database, and
 * makes sure every existing account has a subscription row (defaulting to Free).
 *
 * Safe to re-run: it updates plans in place by their key and only creates the
 * subscriptions that are missing, so it doubles as the backfill for accounts
 * that predate billing.
 *
 * Usage: npm run seed:plans
 */

require("dotenv").config();

const { sequelize } = require("../config/db");
const Plan = require("../models/Plan");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const { PLANS } = require("../config/billing");

async function run() {
  await sequelize.authenticate();

  for (const plan of PLANS) {
    const [row, created] = await Plan.findOrCreate({ where: { key: plan.key }, defaults: plan });
    if (!created) await row.update(plan);
    console.log(`  ${created ? "created" : "updated"} plan: ${plan.key} (${plan.priceMinor === 0 ? "free" : plan.currency + " " + plan.priceMinor / 100})`);
  }

  // Backfill: any account without a subscription gets a Free one.
  const users = await User.findAll({ attributes: ["id"] });
  let backfilled = 0;
  for (const user of users) {
    const [, created] = await Subscription.findOrCreate({
      where: { userId: user.id },
      defaults: { userId: user.id, planKey: "free", status: "active", provider: "none" }
    });
    if (created) backfilled += 1;
  }
  console.log(`\nBackfilled ${backfilled} account(s) onto the Free plan.`);
  console.log("Done.");
}

run()
  .then(() => sequelize.close())
  .catch(async (error) => {
    console.error("Seed failed:", error.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  });
