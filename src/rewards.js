const cron = require("node-cron");
const {
  withdrawAndSwap,
  distributeRewards,
} = require("./helpers/holdersRewards");

// 2 MIN
// Runs every 2 minutes (at :01, :03, :05, :07, :09, etc.)
cron.schedule("* * * * *", async () => {
  console.log("🏁🏁🏁 Running scheduled withdraw and swap 🏁🏁🏁");
  // await withdrawAndSwap();
  await distributeRewards();
});

// 10 MIN
// Runs every 10 minutes (e.g., :00, :10, :20, :30, :40, :50)
cron.schedule("*/10 * * * *", async () => {
  console.log("🏁🏁🏁 Running scheduled distribution 🏁🏁🏁");
  // await distributeRewards();
});
