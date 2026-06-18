const app = require("./app");
const { connectDB } = require("./config/db");

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Excel Connect Hub API running on port ${PORT}`);
  });
});
