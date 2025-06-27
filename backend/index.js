const sequelize = require('./config/db');
const bot = require('./bot');
const Task = require('./models/Task');
const Doer = require('./models/Doer'); 
const cors = require('cors');
const express = require('express');
const app = express();
require('dotenv').config();
const taskRoutes = require('./routes/taskRoutes');




app.use(express.json());


app.use(cors());

// Mount the route
app.use('/api/tasks', taskRoutes);



(async () => {
    try {
        await sequelize.sync({ alter: true }); // sync DB
        console.log("Database synced");
        await bot.telegram.deleteWebhook();
        bot.launch();
        // start bot
        console.log("Bot is running");
    } catch (error) {
        console.log("Startup error: ", error);
    }
})();



// Start the server
const PORT = process.env.PORT || 3000;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});





// 3. Graceful stop handlers (put these last)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));