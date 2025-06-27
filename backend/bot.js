const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();
const { Op } = require('sequelize');
const Task = require('./models/Task');
const sequelize = require("./config/db");
const Doer = require('./models/Doer');
const bot = new Telegraf(process.env.BOT_TOKEN);






const ROLES = {
    boss: 7724001439,         // ← replace with your Telegram ID
    // boss: 1096067043,   // harsh sir
    ea: 1359630106            // ← EA's Telegram ID
};






// ========== 1. Helper: Check if current user is the Boss ==========
// Checks if the current ctx is from the Boss by comparing chatId to ROLES.boss
function isBoss(ctx) {
    const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
    return chatId === ROLES.boss;
}



// ========== 2. Show Tasks by Status for Doers ==========
// Given a status (pending, completed, etc.), fetches up to 10 tasks for the current doer
// Sends each task as a message, with action buttons for 'pending'/'revised' statuses
async function showTasksByStatus(ctx, status) {
    const telegramId = ctx.chat.id;
    const doer = await Doer.findOne({ where: { telegramId } });
    if (!doer) return ctx.reply("❌ Not registered.");

    const whereClause = { doer: doer.name, status };
    const tasks = await Task.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: 10
    });

    if (!tasks.length)
        return ctx.reply(`📭 No *${status}* tasks found.`, { parse_mode: 'Markdown' });

    for (const task of tasks) {
        // Inline buttons only for pending/revised
        let buttons = [];
        if (status === 'pending' || status === 'revised') {
            buttons = [
                [Markup.button.callback('✅ Mark as Completed', `TASK_DONE_${task.id}`)],
                [Markup.button.callback('🗓️ Request Extension', `TASK_EXT_${task.id}`)],
                [Markup.button.callback('🚫 Request Cancellation', `TASK_CANCEL_${task.id}`)]
            ];
        }
        await ctx.reply(
            `📝 *Task:* ${task.task}
🆔 *ID:* ${task.id}
⏱️ *Urgency:* ${task.urgency}
📅 *Due Date:* ${task.dueDate ? new Date(task.dueDate).toDateString() : 'ASAP'}
📌 *Status:* ${task.status.charAt(0).toUpperCase() + task.status.slice(1)}`,
            {
                parse_mode: 'Markdown',
                ...(buttons.length && Markup.inlineKeyboard(buttons)),
            }
        );
    }
}





// FOR DOERS

// ========== 3. Doer Self-Registration Command ==========
// /register: Allows a user to register their Telegram ID if their name exists in the Doer table
// If already registered, notifies user. If not found in DB, asks to contact admin.
// doer will register themselves and all the register user will save to the doers table which can be shown to boss to assign task
bot.command('register', async (ctx) => {
    console.log("register is called");
    const telegramId = ctx.chat.id;
    const fullName = `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim().toUpperCase();


    try {
        const doer = await Doer.findOne({
            where: { name: fullName }
        });

        if (!doer) {
            ctx.reply(`❌ Your name "${fullName}" is not found in the system. Please contact admin to add you.`);
        } else if (doer.telegramId) {
            ctx.reply("✅ You are already registered.");
        } else {
            doer.telegramId = telegramId;
            await doer.save();
            ctx.reply(`✅ ${fullName}, you are now registered with Telegram ID.`);
        }
    } catch (error) {
        console.error("❌ Register error:", error);
        ctx.reply("⚠️ Registration failed. Please try again or contact support.");
    }
});



// ========== 4. Show Task Filter Buttons for Doers ==========
// /tasks: Only available to non-boss users; displays filter buttons to view tasks by status
// Four inline buttons for pending/completed/revised/canceled
bot.command('tasks', async (ctx) => {

    if (isBoss(ctx)) return ctx.reply("❌ Bosses delegate, not do! 😎");

    const telegramId = ctx.chat.id;
    const doer = await Doer.findOne({ where: { telegramId } });

    if (!doer) {
        return ctx.reply("❌ You are not registered. Use /register first.");
    }

    // Status filter buttons
    return ctx.reply(
        "🔍 *View your tasks by status:*",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('⏳ Pending', 'TASKS_PENDING')],
                [Markup.button.callback('✅ Completed', 'TASKS_COMPLETED')],
                [Markup.button.callback('📝 Revised', 'TASKS_REVISED')],
                [Markup.button.callback('❌ Canceled', 'TASKS_CANCELED')],
            ])
        }
    );


});


// ========== 5. Action Handlers for Task Status Filters ==========
// Handles clicks on the filter buttons to display the relevant tasks list for doer
bot.action('TASKS_PENDING', ctx => showTasksByStatus(ctx, 'pending'));
bot.action('TASKS_COMPLETED', ctx => showTasksByStatus(ctx, 'completed'));
bot.action('TASKS_REVISED', ctx => showTasksByStatus(ctx, 'revised'));
bot.action('TASKS_CANCELED', ctx => showTasksByStatus(ctx, 'canceled'));



// ========== 6. Mark Task as Completed Handler ==========
// Handles the "Mark as Completed" button, updates task status, notifies EA and doer
bot.action(/^TASK_DONE_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery(); // closes loading state on button
    const taskId = parseInt(ctx.match[1]);
    const chatId = ctx.chat.id;

    const doer = await Doer.findOne({ where: { telegramId: chatId } });
    const task = await Task.findByPk(taskId);

    if (!task || !doer || task.doer !== doer.name)
        return ctx.reply("⚠️ Task not found or not assigned.");

    if (task.status === 'completed')
        return ctx.reply("✅ Already marked as completed.");

    task.status = 'completed';
    await task.save();

    ctx.reply("🎉 *Congrats!* Task marked as *Completed*. 🚀", { parse_mode: 'Markdown' });

    // Notify EA
    await bot.telegram.sendMessage(
        ROLES.ea,
        `🎯 *Task Completed*\n\n👤 *Doer:* ${doer.name}\n📝 *Task:* ${task.task}\n🆔 *ID:* ${task.id}\n✅ Status: *Completed*`,
        { parse_mode: 'Markdown' }
    );
});

// ========== 7. Request Task Extension: Start Session ==========
// Handles "Request Extension" button; asks doer to type new due date in YYYY-MM-DD format
// Tracks expected input using extensionSessions[chatId]

const extensionSessions = {};
bot.action(/^TASK_EXT_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const taskId = parseInt(ctx.match[1]);
    extensionSessions[ctx.chat.id] = taskId;

    await ctx.reply(
        "📅 Please enter the *new due date* for your extension in the format YYYY-MM-DD (e.g. 2024-07-15).",
        { parse_mode: 'Markdown' }
    );

});

// ========== 8. Extension Date Input Handler ==========
// Listens for text input; if user is in extensionSessions, validates date, saves to DB, notifies EA
bot.on('text', async (ctx, next) => {
    const chatId = ctx.chat.id;

    // Only intercept if expecting extension date from this user
    if (!extensionSessions[chatId]) return next();

    const dateText = ctx.message.text.trim();
    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
        return ctx.reply("⚠️ *Invalid date format.*\nPlease type the date as YYYY-MM-DD (e.g. 2024-07-15).", { parse_mode: 'Markdown' });
    }

    const dateParts = dateText.split('-').map(Number);
    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // compare only date parts

    // Check for invalid dates (e.g. 2024-02-30) and past dates
    if (
        isNaN(date.getTime()) ||
        date.getFullYear() !== dateParts[0] ||
        date.getMonth() !== dateParts[1] - 1 ||
        date.getDate() !== dateParts[2] ||
        date < today
    ) {
        return ctx.reply("⚠️ *Invalid or past date.*\nPlease enter a real, future date as YYYY-MM-DD (e.g. 2024-07-15).", { parse_mode: 'Markdown' });
    }

    // Now process the extension request
    const taskId = extensionSessions[chatId];
    const doer = await Doer.findOne({ where: { telegramId: chatId } });
    const task = await Task.findByPk(taskId);

    if (!task || !doer || task.doer !== doer.name) {
        delete extensionSessions[chatId];
        return ctx.reply("⚠️ Task not found or not assigned.");
    }
    if (task.status === 'completed') {
        delete extensionSessions[chatId];
        return ctx.reply("✅ Task already completed.");
    }

    // Save extension request
    task.extensionRequestedDate = date;
    await task.save();

    await ctx.reply(
        `📅 Extension requested for *${date.toDateString()}*. EA will review your request.`,
        { parse_mode: 'Markdown' }
    );

    await bot.telegram.sendMessage(
        ROLES.ea,
        `🔁 *Extension Requested*\n\n👤 *Doer:* ${doer.name}\n🆔 *Task ID:* ${task.id}\n📝 *Task:* ${task.task}\n📅 *Requested Date:* ${date.toDateString()}`,
        {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('✅ Approve Extension', `EXT_APPROVE_${task.id}`)],
                [Markup.button.callback('❌ Reject Extension', `EXT_REJECT_${task.id}`)]
            ]).reply_markup
        }
    );
    delete extensionSessions[chatId];
});



// ========== 9. Request Task Cancellation: Start Session ==========
// Handles "Request Cancellation" button; asks doer to type reason, tracks using cancellationSessions[chatId]
const cancellationSessions = {};
bot.action(/^TASK_CANCEL_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const taskId = parseInt(ctx.match[1]);
    cancellationSessions[ctx.chat.id] = taskId;
    await ctx.reply("✍️ Please type your *reason* for cancellation of this task:", { parse_mode: 'Markdown' });
});

// ========== 10. Cancellation Reason Input Handler ==========
// Listens for text input; if user is in cancellationSessions, saves reason, sets cancellationRequested=true, notifies EA
bot.on('text', async (ctx, next) => {
    const chatId = ctx.chat.id;
    // Only handle if in cancellation flow
    if (!cancellationSessions[chatId]) return next();

    const reason = ctx.message.text;
    const taskId = cancellationSessions[chatId];
    const doer = await Doer.findOne({ where: { telegramId: chatId } });
    const task = await Task.findByPk(taskId);

    if (!task || !doer || task.doer !== doer.name) {
        delete cancellationSessions[chatId];
        return ctx.reply("⚠️ Task not found or not assigned.");
    }

    task.cancellationRequested = true;
    task.cancellationReason = reason;
    await task.save();

    await ctx.reply("🚩 Cancellation request submitted. Awaiting EA review.");

    await bot.telegram.sendMessage(
        ROLES.ea,
        `🚫 *Cancellation Requested*\n\n👤 *Doer:* ${doer.name}\n🆔 *Task ID:* ${task.id}\n📝 *Task:* ${task.task}\n✍️ *Reason:* ${reason}`,
        {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('✅ Approve Cancel', `CANCEL_APPROVE_${task.id}`)],
                [Markup.button.callback('❌ Reject Cancel', `CANCEL_REJECT_${task.id}`)]
            ]).reply_markup
        }
    );
    delete cancellationSessions[chatId];
});





bot.command('cancel', async (ctx) => {
    const chatId = ctx.chat.id;

    if (![ROLES.boss, ROLES.ea].includes(chatId)) {
        return ctx.reply("❌ You are not authorized to access cancellation requests.");
    }

    const tasks = await Task.findAll({
        where: {
            cancellationRequested: true,
        },
        order: [['updatedAt', 'DESC']],
        limit: 10
    });


    if (!tasks.length) return ctx.reply("📭 No pending cancellation requests.");

    for (const task of tasks) {
        await ctx.replyWithMarkdown(
            `🚫 *Cancellation Requested*\n\n👤 *Doer:* ${task.doer}\n🆔 *Task ID:* ${task.id}\n📝 *Task:* ${task.task}\n✍️ *Reason:* ${task.cancellationReason}`,
            {
                parse_mode: 'Markdown',
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback('✅ Approve Cancel', `CANCEL_APPROVE_${task.id}`)],
                    [Markup.button.callback('❌ Reject Cancel', `CANCEL_REJECT_${task.id}`)]
                ]).reply_markup
            }
        );
    }
});


// ========== 12. EA Approval Handler for Cancellation Request ==========
// EA can approve cancellation: marks as canceled, notifies doer
bot.action(/^CANCEL_APPROVE_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const taskId = parseInt(ctx.match[1]);
    const task = await Task.findByPk(taskId);

    if (!task) return ctx.reply("❌ Task not found.");
    if (!task.cancellationRequested) return ctx.reply("⚠️ No cancellation requested.");

    task.status = 'canceled';
    task.cancellationRequested = false;
    await task.save();

    await ctx.reply(`✅ Task ID ${task.id} canceled.`);
    const doer = await Doer.findOne({ where: { name: task.doer } });
    if (doer?.telegramId) {
        await bot.telegram.sendMessage(
            doer.telegramId,
            `🚫 Your cancellation request has been *Approved* for task ID ${task.id}.\nTask is now *Canceled*.\n\n📝 *Task:* ${task.task}`,
            { parse_mode: 'Markdown' }
        );
    }
});

// ========== 13. EA Reject Handler for Cancellation Request ==========
// EA can reject cancellation: resets cancellationRequested, notifies doer
bot.action(/^CANCEL_REJECT_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const taskId = parseInt(ctx.match[1]);
    const task = await Task.findByPk(taskId);

    if (!task) return ctx.reply("❌ Task not found.");
    if (!task.cancellationRequested) return ctx.reply("⚠️ No cancellation requested.");

    task.cancellationRequested = false;
    await task.save();

    await ctx.reply(`❌ Cancellation rejected for task ID ${task.id}.`);
    const doer = await Doer.findOne({ where: { name: task.doer } });
    if (doer?.telegramId) {
        await bot.telegram.sendMessage(
            doer.telegramId,
            `🚩 Your cancellation request has been *Rejected* for task ID ${task.id}.\n\n📝 *Task:* ${task.task}`,
            { parse_mode: 'Markdown' }
        );
    }
});




// First, only EA and Boss can see the extension request and they get the option for APPROVE and REJECT 
bot.command('extensions', async (ctx) => {
    const chatId = ctx.chat.id;

    if (![ROLES.boss, ROLES.ea].includes(chatId)) {
        return ctx.reply("❌ You are not authorized to access extension requests.");
    }

    const tasks = await Task.findAll({
        where: {
            status: 'pending',
            extensionRequestedDate: { [Op.not]: null }
        },
        order: [['updatedAt', 'DESC']],
        limit: 10
    });

    if (!tasks.length) return ctx.reply("📭 No pending extension requests.");

    for (const task of tasks) {
        await ctx.replyWithMarkdown(
            `📄 *Task:* ${task.task}\n👤 *Doer:* ${task.doer}\n🆔 *ID:* ${task.id}\n📅 *Requested Date:* ${task.extensionRequestedDate.toDateString()}`,
            Markup.inlineKeyboard([
                Markup.button.callback('✅ Approve', `EXT_APPROVE_${task.id}`),
                Markup.button.callback('❌ Reject', `EXT_REJECT_${task.id}`)
            ])
        );
    }
});


// Second, only EA and BOSS can approve the request if they approve, it update the due date to extension date and extension date to null and then status = revised and then notify to the doer that its been approved.
bot.action(/^EXT_APPROVE_(\d+)$/, async (ctx) => {
    const taskId = parseInt(ctx.match[1]);
    const task = await Task.findByPk(taskId);

    if (!task) return ctx.reply("❌ Task not found.");
    if (!task.extensionRequestedDate) return ctx.reply("⚠️ No extension requested for this task.");

    task.dueDate = task.extensionRequestedDate;
    task.status = 'revised'; // 👈 optional
    task.extensionRequestedDate = null;
    await task.save();

    ctx.reply(`✅ Extension approved for task ID ${task.id}.`);

    // Notify doer
    const doer = await Doer.findOne({ where: { name: task.doer } });
    if (doer?.telegramId) {
        await bot.telegram.sendMessage(doer.telegramId,
            `✅ *Extension Approved*\n\n📄 ${task.task}\n📅 New Due Date: ${task.dueDate.toDateString()}`,
            { parse_mode: 'Markdown' }
        );
    }
});


// Third, only EA and BOSS can reject the request if they reject, it revert the extension date = null and then  notify to the doer that its been rejected.
bot.action(/^EXT_REJECT_(\d+)$/, async (ctx) => {
    const taskId = parseInt(ctx.match[1]);
    const task = await Task.findByPk(taskId);

    if (!task) return ctx.reply("❌ Task not found.");
    if (!task.extensionRequestedDate) return ctx.reply("⚠️ No extension requested for this task.");

    task.extensionRequestedDate = null;
    await task.save();

    ctx.reply(`❌ Extension rejected for task ID ${task.id}.`);

    // Notify doer
    const doer = await Doer.findOne({ where: { name: task.doer } });
    if (doer?.telegramId) {
        await bot.telegram.sendMessage(doer.telegramId,
            `❌ *Extension Request Rejected*\n\n📄 ${task.task}`,
            { parse_mode: 'Markdown' }
        );
    }
});














let taskSession = {};

// Utility to get consistent chat ID
function getChatId(ctx) {
    return ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
}


const showOptions = (ctx) => {
    ctx.reply('Hi Boss! What would you like to do?', Markup.inlineKeyboard([
        [Markup.button.callback('Assign Task', 'ASSIGN')],
        [Markup.button.callback('Check Task Status', 'STATUS')]
    ]));
};

// START BOT
bot.start((ctx) => {
    if (!isBoss(ctx)) return ctx.reply("❌ You are not authorized to use this bot.");
    showOptions(ctx);
});


// bot.hears(/^(hi|hello|hey|Hi|Hey|Hello)$/i, showOptions);
bot.hears(/^(hi|hello|hey)$/i, (ctx) => {
    if (!isBoss(ctx)) return ctx.reply("❌ You are not authorized to use this bot.");
    showOptions(ctx);
});




// ASSIGN TASK - SELECT DOER
bot.action('ASSIGN', async (ctx) => {
    if (!isBoss(ctx)) return ctx.reply("❌ Only the Boss can assign tasks.");
    const chatId = getChatId(ctx);
    taskSession[chatId] = {};

    const doers = await Doer.findAll({ where: { isActive: true } });
    if (!doers.length) {
        return ctx.reply("⚠️ No doers found in the database. Please add them.");
    }
    const buttons = doers.map(d => [Markup.button.callback(d.name, `DOER_${d.id}`)]);

    ctx.reply('Select a doer:', Markup.inlineKeyboard(buttons));
});


bot.action('STATUS', async (ctx) => {
    if (!isBoss(ctx)) return ctx.reply("❌ Only the Boss can check task statuses.");

    ctx.reply("📋 Select the task status you want to view:", Markup.inlineKeyboard([
        [Markup.button.callback('📌 Pending', 'STATUS_PENDING')],
        [Markup.button.callback('✅ Completed', 'STATUS_COMPLETED')],
        [Markup.button.callback('🔁 Revised', 'STATUS_REVISED')]
    ]));
});





// HANDLE DOER SELECTED

bot.action(/DOER_(\d+)/, async (ctx) => {
    if (!isBoss(ctx)) return ctx.reply("❌ Only the Boss can assign tasks.");

    const chatId = getChatId(ctx);
    const doerId = parseInt(ctx.match[1]);
    console.log("doerId:", doerId);
    const doer = await Doer.findByPk(doerId);

    if (!doer) return ctx.reply("❌ Doer not found.");

    taskSession[chatId] = {
        doerName: doer.name,
        doerId: doer.id,
        doerTelegramId: doer.telegramId
    };

    ctx.reply(`Great! Now type the task for ${doer.name}:`);
});




// HANDLE TEXT INPUT (TASK or DUE DATE)
bot.on('text', async (ctx) => {
    if (!isBoss(ctx)) return ctx.reply("❌ Only the Boss can perform this action.");

    const chatId = getChatId(ctx);
    const session = taskSession[chatId];
    if (!session) return;

    // Case 1: Task input
    if (!session.task) {
        session.task = ctx.message.text;

        ctx.reply('Set urgency or due date:', Markup.inlineKeyboard([
            [Markup.button.callback('Now Now (Urgent)', 'URGENT')],
            [Markup.button.callback('Completed By (Pick Date)', 'DATE')]
        ]));
        return;
    }

    // Case 2: Due date input
    if (session.task && !session.dueDate && session.urgency !== 'urgent') {
        session.dueDate = new Date(ctx.message.text);
        session.urgency = 'scheduled';

        showReviewOptions(ctx, session);
    }
});

// URGENT SELECTED
bot.action('URGENT', (ctx) => {
    if (!isBoss(ctx)) return ctx.reply("❌ Only the Boss can perform this action.");


    const chatId = getChatId(ctx);
    const session = taskSession[chatId];

    if (!session) return;
    session.urgency = 'urgent';
    session.dueDate = null;

    showReviewOptions(ctx, session);
});

// DATE SELECTED
bot.action('DATE', (ctx) => {
    if (!isBoss(ctx)) return ctx.reply("❌ Only the Boss can perform this action.");

    ctx.reply('Please type the due date (YYYY-MM-DD):');
});



// SHOW PREVIEW
function showReviewOptions(ctx, session) {
    ctx.reply(`📝 *Task Preview*:
👤 Doer: ${session.doerName}
📄 Task: ${session.task}
⏱️ Urgency: ${session.urgency}
📅 Due: ${session.dueDate ? session.dueDate.toDateString() : 'ASAP'}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Edit Task', 'EDIT')],
            [Markup.button.callback('✅ Send Task', 'SEND')]
        ])
    });
}

// EDIT TASK
bot.action('EDIT', (ctx) => {
    if (!isBoss(ctx)) return ctx.reply("❌ Only the Boss can perform this action.");


    const chatId = getChatId(ctx);
    const session = taskSession[chatId];

    if (!session) return;
    delete session.task;
    ctx.reply('Please retype the task:');
});



// SEND TASK TO DB
bot.action('SEND', async (ctx) => {

    if (!isBoss(ctx)) return ctx.reply("❌ Only the Boss can perform this action.");


    const chatId = getChatId(ctx);
    const session = taskSession[chatId];

    if (!session) return;

    const newTask = await Task.create({
        task: session.task,
        doer: session.doerName,
        urgency: session.urgency,
        dueDate: session.dueDate
    });

    ctx.reply(`✅ Task sent to ${session.doerName} successfully!`);

    // 🛎 Notify the doer on Telegram
    if (session.doerTelegramId) {
        try {
            await bot.telegram.sendMessage(session.doerTelegramId,
                `📥 *New Task Assigned*\n\n📄 ${session.task}\n⏱️ ${session.urgency}\n📅 ${session.dueDate ? session.dueDate.toDateString() : 'ASAP'}`,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            console.log("❌ Failed to notify doer:", err.message);
        }
    } else {
        ctx.reply(`⚠️ Could not notify ${session.doerName} — Telegram ID is missing.`);
    }


    // Notify EA for follow-up
    try {
        await bot.telegram.sendMessage(ROLES.ea,
            `🧾 *Follow-up Task Alert (EA)*\n\n👤 Doer: ${session.doerName}\n📄 Task: ${session.task}\n⏱️ ${session.urgency}\n📅 ${session.dueDate ? session.dueDate.toDateString() : 'ASAP'}`,
            { parse_mode: 'Markdown' }
        );
    } catch (err) {
        console.log("❌ Failed to notify EA:", err.message);
    }


    delete taskSession[chatId];
});




//  Pending Tasks

bot.action('STATUS_PENDING', async (ctx) => {

    if (!isBoss(ctx)) return ctx.reply("❌ Only the Boss can perform this action.");

    const tasks = await Task.findAll({
        where: { status: 'pending' },
        order: [['createdAt', 'DESC']],
        limit: 10
    });

    if (!tasks.length) return ctx.reply("✅ No pending tasks.");

    const msg = tasks.map(t => `👤 ${t.doer}\n📄 ${t.task}\n📅 ${t.dueDate ? new Date(t.dueDate).toDateString() : 'ASAP'}`).join('\n\n');
    ctx.reply(`🟡 *Pending Tasks:*\n\n${msg}`, { parse_mode: 'Markdown' });
});


// 🟢 Completed Tasks
bot.action('STATUS_COMPLETED', async (ctx) => {

    if (!isBoss(ctx)) return ctx.reply("❌ Only the Boss can perform this action.");

    const tasks = await Task.findAll({
        where: { status: 'completed' },
        order: [['updatedAt', 'DESC']],
        limit: 10
    });

    if (!tasks.length) return ctx.reply("📭 No completed tasks.");

    const msg = tasks.map(t => `👤 ${t.doer}\n📄 ${t.task}\n📅 ${t.dueDate ? new Date(t.dueDate).toDateString() : 'ASAP'}`).join('\n\n');

    console.log("Status_completed: msg: ", msg);
    ctx.reply(`🟢 *Completed Tasks:*\n\n${msg}`, { parse_mode: 'Markdown' });
});

// Revised Tasks (due date extended)
bot.action('STATUS_REVISED', async (ctx) => {

    if (!isBoss(ctx)) return ctx.reply("❌ Only the Boss can perform this action.");

    const tasks = await Task.findAll({
        where: {
            status: 'revised'  // 👈 direct status match
        },
        order: [['updatedAt', 'DESC']],
        limit: 10
    });

    if (!tasks.length) return ctx.reply("🔁 No revised tasks found.");

    const msg = tasks.map(t =>
        `👤 ${t.doer}\n📄 ${t.task}\n📅 New Due: ${t.dueDate ? new Date(t.dueDate).toDateString() : 'ASAP'}`
    ).join('\n\n');

    ctx.reply(`🔁 *Revised Tasks:*\n\n${msg}`, { parse_mode: 'Markdown' });
});



module.exports = bot;
















// const { Scenes, session } = require('telegraf');

// const stepHandler = new Scenes.WizardScene(
//   'my-wizard',
//   (ctx) => {
//     ctx.reply('Step 1');
//     return ctx.wizard.next();
//   },
//   (ctx) => {
//     ctx.reply('Step 2');
//     return ctx.wizard.next();
//   },
//   (ctx) => {
//     ctx.reply('Finished!');
//     return ctx.scene.leave();
//   }
// );

// const stage = new Scenes.Stage([stepHandler]);
// bot.use(session());
// bot.use(stage.middleware());

// bot.command('wizard', (ctx) => ctx.scene.enter('my-wizard'));

