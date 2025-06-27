const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const taskController = require('../controllers/task.controller');

// GET /api/tasks → Get all tasks
// router.get('/', async (req, res) => {
//   try {



//     const tasks = await Task.findAll({
//       order: [['createdAt', 'DESC']],
//       limit: 50 // optional
//     });
//     res.json(tasks);
//   } catch (err) {
//     console.error("❌ Failed to fetch tasks:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });


// GET /api/tasks?status=COMPLETED&doer=John&query=meeting&urgent=true&from=2024-01-01&to=2024-01-31
// routes/tasks.js


const { Op } = require('sequelize');



router.get('/', taskController.listTask);

// router.get('/', async (req, res) => {
//   try {
//     const { status, doer, query, urgent, from, to } = req.query;
//     const where = {};

//     if (status) where.status = status;
//     if (doer) where.doer = { [Op.like]: `%${doer}%` }; // partial match

//     if (urgent === "true") where.urgency = "URGENT";
//     if (from || to) {
//       where.dueDate = {};
//       if (from) where.dueDate[Op.gte] = from;
//       if (to) where.dueDate[Op.lte] = to;
//     }

//     if (query) {
//       where[Op.or] = [
//         { task: { [Op.like]: `%${query}%` } },
//         { doer: { [Op.like]: `%${query}%` } },
//       ];
//     }

//     const tasks = await Task.findAll({
//       where,
//       order: [["createdAt", "DESC"]],
//       limit: 50
//     });

//     res.json(tasks);
//   } catch (err) {
//     console.error("❌ Failed to fetch tasks:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });


module.exports = router;
