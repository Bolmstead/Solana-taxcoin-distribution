require("dotenv").config();
const cron = require("node-cron");

// Schedule the distribution to run every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  console.log("Running scheduled distribution...");
});

// Initial run
distributeTokens().then(() => {
  console.log(
    "Initial distribution complete. Waiting for next scheduled run..."
  );
});
