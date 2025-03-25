const cron = require("node-cron");
const {
  withdrawAndSwap,
  distributeRewards,
} = require("./helpers/holdersRewards");

// 3 MIN
// Runs at exactly :03, :06, :09, :13, :16, :19, :23, :26, :29, :33, :36, :39, :43, :46, :49, :53, :56, :59
// cron.schedule("3,7,13,17,23,27,33,37,43,47,53,57 * * * *", async () => {
//   console.log("🏁🏁🏁 Running scheduled withdraw and swap 🏁🏁🏁");
//   await withdrawAndSwap();
//   const now = new Date();
//   console.log("⏰ Withdraw and Swap completed at:", now.toLocaleString());
// });

// 10 MIN
// Runs every 10 minutes (e.g., :00, :10, :20, :30, :40, :50)
cron.schedule("*/10 * * * *", async () => {
  console.log("🏁🏁🏁 Running scheduled distribution 🏁🏁🏁");
  await distributeRewards();
  const now = new Date();
  console.log("⏰ Distribution completed at:", now.toLocaleString());
});
