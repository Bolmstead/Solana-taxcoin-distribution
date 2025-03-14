require("dotenv").config();
const cron = require("node-cron");
const { execute } = require("./helpers/tokenHolders");
// Schedule the distribution to run every 5 minutes
cron.schedule("*/1 * * * *", async () => {
  console.log("Running scheduled distribution...");
  await execute();
});
