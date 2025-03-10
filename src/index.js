require("dotenv").config();
const cron = require("node-cron");
const { distributeTokens } = require("./helpers/tokenDistribution");

// Schedule the distribution to run every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  console.log("Running scheduled distribution...");
  await distributeTokens();
});

// Initial run
distributeTokens().then(() => {
  console.log(
    "Initial distribution complete. Waiting for next scheduled run..."
  );
});
