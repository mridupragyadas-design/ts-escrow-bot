import { Telegraf } from 'telegraf';
import express from 'express';
import fs from 'fs-extra';
import dotenv from 'dotenv';

dotenv.config();

// ==================== CONFIG ====================
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const PORT = parseInt(process.env.PORT || '8080');

const OWNER_ID = 2096985880;
const ADMINS = [2096985880, 8737155576];

const STATS_FILE = 'admin_stats.json';
const USER_STATS_FILE = 'user_escrow_stats.json';

// ==================== TYPES ====================
interface AdminStats {
    count: number;
    total: number;
    username: string;
}

interface UserEscrowStats {
    total_escrows: number;
    total_amount: number;
    username: string;
}

interface PendingTrade {
    message_id: number;
    buyer: string;
    seller: string;
    amount: string;
}

// ==================== STATS HELPERS ====================
function loadStats(): Record<string, AdminStats> {
    if (fs.existsSync(STATS_FILE)) {
        try {
            return fs.readJsonSync(STATS_FILE);
        } catch {
            return {};
        }
    }
    return {};
}

function saveStats(stats: Record<string, AdminStats>): void {
    fs.writeJsonSync(STATS_FILE, stats, { spaces: 2 });
}

function loadUserStats(): Record<string, UserEscrowStats> {
    if (fs.existsSync(USER_STATS_FILE)) {
        try {
            return fs.readJsonSync(USER_STATS_FILE);
        } catch {
            return {};
        }
    }
    return {};
}

function saveUserStats(stats: Record<string, UserEscrowStats>): void {
    fs.writeJsonSync(USER_STATS_FILE, stats, { spaces: 2 });
}

function isAdmin(userId: number): boolean {
    return ADMINS.includes(userId) || userId === OWNER_ID;
}

// ==================== PENDING TRADES ====================
const pendingTrades: Record<string, PendingTrade[]> = {};

// ==================== EXPRESS SERVER ====================
const app = express();

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

const server = app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

// ==================== TELEGRAM BOT ====================
const bot = new Telegraf(BOT_TOKEN);

// Helper function to reply to a message
function replyToMessage(ctx: any, text: string, extra: any = {}) {
    return ctx.reply(text, {
        ...extra,
        reply_parameters: {
            message_id: ctx.message.message_id
        }
    });
}

// ==================== COMMAND HANDLERS ====================

// Start command
bot.start(async (ctx) => {
    await replyToMessage(ctx,
        '🤖 *Escrow Bot is running!*\n\n' +
        'Type `form` to get the escrow form.',
        { parse_mode: 'Markdown' }
    );
});

// Help command
bot.command('help', async (ctx) => {
    await replyToMessage(ctx,
        '📋 *Available Commands*\n\n' +
        '`form` - Show escrow form\n' +
        '`/add` - Add trade (reply to form)\n' +
        '`/done` - Complete trade (reply to trade message)\n' +
        '`/cancel` - Cancel trade (reply to trade message)\n' +
        '`/mydeals` - Your escrow stats\n' +
        '`/info` - User info (reply or @username)',
        { parse_mode: 'Markdown' }
    );
});

// ============================================================
// FORM HANDLER
// ============================================================
bot.hears(/^form$/i, async (ctx) => {
    console.log('Form triggered!');
    const formMsg =
        '𝙈𝙍𝙄𝙓𝘿𝙐 𝙀𝙎𝘾𝙍𝙊𝙒 𝙂𝙍𝙊𝙐𝙋🔐\n\n' +
        '𝘿𝙚𝙖𝙡 𝘿𝙚𝙩𝙖𝙞𝙡𝙨\n' +
        '• Deal Info:   \n' +
        '• Buyer:   \n' +
        '• Seller:  \n' +
        '• Amount:  \n' +
        '• Duration:  \n' +
        '• Escrow Until:  \n' +
        '• Releasee Condition: (Optional)\n\n' +
        '𝙀𝙓𝙏𝙍𝘼\n' +
        'CRYPTO ADDRESS : (Optional)\n\n' +
        '⚠️ 𝙎𝙚𝙘𝙪𝙧𝙞𝙩𝙮 𝙉𝙤𝙩𝙞𝙘𝙚\n' +
        'Admins will NEVER DM you for payment.Verify via /adminlist before proceeding.';
    
    await replyToMessage(ctx, formMsg);
});

bot.command('form', async (ctx) => {
    console.log('Form triggered via /form!');
    const formMsg =
        '𝙈𝙍𝙄𝙓𝘿𝙐 𝙀𝙎𝘾𝙍𝙊𝙒 𝙂𝙍𝙊𝙐𝙋🔐\n\n' +
        '𝘿𝙚𝙖𝙡 𝘿𝙚𝙩𝙖𝙞𝙡𝙨\n' +
        '• Deal Info:   \n' +
        '• Buyer:   \n' +
        '• Seller:  \n' +
        '• Amount:  \n' +
        '• Duration:  \n' +
        '• Escrow Until:  \n' +
        '• Releasee Condition: (Optional)\n\n' +
        '𝙀𝙓𝙏𝙍𝘼\n' +
        'CRYPTO ADDRESS : (Optional)\n\n' +
        '⚠️ 𝙎𝙚𝙘𝙪𝙧𝙞𝙩𝙮 𝙉𝙤𝙩𝙞𝙘𝙚\n' +
        'Admins will NEVER DM you for payment.Verify via /adminlist before proceeding.';
    
    await replyToMessage(ctx, formMsg);
});

// ============================================================
// /add command
// ============================================================
bot.command('add', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await replyToMessage(ctx, '⚠️ Only admins can add trades!');
        return;
    }

    const reply = ctx.message?.reply_to_message;
    if (!reply) {
        await replyToMessage(ctx, '⚠️ Reply to a form message.');
        return;
    }

    const text = ('text' in reply && reply.text) ? reply.text : '';
    if (!text || !text.includes('Deal Info')) {
        await replyToMessage(ctx, '⚠️ Invalid form message. Reply to a filled form.');
        return;
    }

    let buyer = '';
    let seller = '';
    let amount = '';

    for (const line of text.split('\n')) {
        const cleanLine = line.replace(/[•\*]/g, '').trim();
        if (cleanLine.startsWith('Buyer:')) {
            buyer = cleanLine.split('Buyer:')[1]?.trim() || '';
        } else if (cleanLine.startsWith('Seller:')) {
            seller = cleanLine.split('Seller:')[1]?.trim() || '';
        } else if (cleanLine.startsWith('Amount:')) {
            amount = cleanLine.split('Amount:')[1]?.trim() || '';
        }
    }

    if (!buyer || !seller || !amount) {
        await replyToMessage(ctx, '⚠️ Could not find Buyer, Seller, or Amount in the form.');
        return;
    }

    const chatId = ctx.chat.id.toString();
    if (!pendingTrades[chatId]) {
        pendingTrades[chatId] = [];
    }

    pendingTrades[chatId].push({
        message_id: reply.message_id,
        buyer,
        seller,
        amount,
    });

    const msg =
        `💰 𝗙𝘂𝗻𝗱𝘀 𝗔𝗱𝗱𝗲𝗱✅,𝗣𝗮𝘆𝗺𝗲𝗻𝘁 𝗥𝗲𝗰𝗲𝗶𝘃𝗲𝗱,𝗖𝗼𝗻𝘁𝗶𝗻𝘂𝗲 𝗗𝗲𝗮𝗹!\n\n` +
        `🧑‍💼 Escrower: @${ctx.from.username || 'Unknown'}\n` +
        `💰 Amount: ₹${amount}\n` +
        `👨🏻‍💼 Buyer: ${buyer}\n` +
        `🙎🏻‍♂️ Seller: ${seller}\n\n` +
        `🔐 𝗖𝗥𝗘𝗔𝗧𝗘𝗗 𝗕𝗬 @MRIXDUX`;

    await replyToMessage(ctx, msg);
});

// ============================================================
// /done command
// ============================================================
bot.command('done', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await replyToMessage(ctx, '⚠️ Only admins can release trades!');
        return;
    }

    const reply = ctx.message?.reply_to_message;
    if (!reply) {
        await replyToMessage(ctx, '⚠️ Reply to trade message.');
        return;
    }

    const chatId = ctx.chat.id.toString();
    let tradeInfo: PendingTrade | null = null;

    if (pendingTrades[chatId]) {
        const index = pendingTrades[chatId].findIndex(t => t.message_id === reply.message_id);
        if (index !== -1) {
            tradeInfo = pendingTrades[chatId][index];
            pendingTrades[chatId].splice(index, 1);
        }
    }

    if (!tradeInfo) {
        await replyToMessage(ctx, '⚠️ Trade not found.');
        return;
    }

    const userId = ctx.from.id.toString();
    const username = ctx.from.username || 'Unknown';
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = { count: 0, total: 0, username };
    }
    stats[userId].count += 1;
    const amt = parseFloat(tradeInfo.amount.replace(/[₹,]/g, '')) || 0;
    stats[userId].total += amt;
    saveStats(stats);

    const userStats = loadUserStats();
    const updateUserEscrow = (uname: string, amountVal: number) => {
        if (!uname || uname.trim() === '') return;
        const key = uname.toLowerCase().replace(/^@/, '');
        if (!userStats[key]) {
            userStats[key] = { total_escrows: 0, total_amount: 0, username: uname };
        }
        userStats[key].total_escrows += 1;
        userStats[key].total_amount += amountVal;
    };

    updateUserEscrow(tradeInfo.buyer, amt);
    updateUserEscrow(tradeInfo.seller, amt);
    saveUserStats(userStats);

    const msg =
        `✅ 𝗙𝘂𝗻𝗱𝘀 𝗥𝗲𝗹𝗲𝗮𝘀𝗲𝗱/𝗧𝗿𝗮𝗱𝗲 𝗰𝗹𝗼𝘀𝗲𝗱!\n\n` +
        `🧑‍💼 Released By: @${ctx.from.username || 'Unknown'}\n` +
        `💸 Amount: ₹${tradeInfo.amount}\n` +
        `👨🏻‍💼 Buyer: ${tradeInfo.buyer}\n` +
        `🙎🏻‍♂️ Seller: ${tradeInfo.seller}\n\n` +
        `🔐 𝗖𝗥𝗘𝗔𝗧𝗘𝗗 𝗕𝗬 @MRIXDUX`;

    await replyToMessage(ctx, msg);
});

// ============================================================
// /cancel command
// ============================================================
bot.command('cancel', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await replyToMessage(ctx, '⚠️ Only admins can cancel trades!');
        return;
    }

    const reply = ctx.message?.reply_to_message;
    if (!reply) {
        await replyToMessage(ctx, '⚠️ Reply to trade message.');
        return;
    }

    const chatId = ctx.chat.id.toString();
    let tradeInfo: PendingTrade | null = null;

    if (pendingTrades[chatId]) {
        const index = pendingTrades[chatId].findIndex(t => t.message_id === reply.message_id);
        if (index !== -1) {
            tradeInfo = pendingTrades[chatId][index];
            pendingTrades[chatId].splice(index, 1);
        }
    }

    if (!tradeInfo) {
        await replyToMessage(ctx, '⚠️ Trade not found.');
        return;
    }

    const msg =
        `🔴 𝗧𝗿𝗮𝗱𝗲/𝗗𝗲𝗮𝗹 𝗖𝗮𝗻𝗰𝗲𝗹𝗹𝗲𝗱!!!!\n\n` +
        `👮🏻‍♂️ Cancelled By: @${ctx.from.username || 'Unknown'}\n` +
        `👨🏻‍💼 Buyer: ${tradeInfo.buyer}\n` +
        `🙎🏻‍♂️ Seller: ${tradeInfo.seller}\n\n` +
        `🔐 𝗖𝗥𝗘𝗔𝗧𝗘𝗗 𝗕𝗬 @MRIXDUX`;

    await replyToMessage(ctx, msg);
});

// ============================================================
// /mydeals command
// ============================================================
bot.command('mydeals', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await replyToMessage(ctx, '⚠️ Admin only!');
        return;
    }

    const stats = loadStats();
    const userId = ctx.from.id.toString();
    const username = ctx.from.username || 'Unknown';

    const count = stats[userId]?.count || 0;
    const total = stats[userId]?.total || 0;

    const msg =
        `📊 Your Escrow Stats @${username}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `🧑‍💼 Total Escrows Closed: ${String(count).padStart(3, '0')}\n\n` +
        `💰 INR Deals: ${String(count).padStart(3, '0')} | ₹${total}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `⚙️ Powered by @mrixdufr`;

    await replyToMessage(ctx, msg);
});

// ============================================================
// /info command
// ============================================================
bot.command('info', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await replyToMessage(ctx, '⚠️ Admin only!');
        return;
    }

    let targetUser: any = null;

    if (ctx.message?.reply_to_message) {
        targetUser = ctx.message.reply_to_message.from;
    } else {
        const text = ctx.message?.text || '';
        const parts = text.split(' ');
        if (parts.length > 1) {
            const username = parts[1].replace('@', '');
            try {
                const chatMember = await ctx.telegram.getChatMember(ctx.chat.id, username as any);
                targetUser = chatMember.user;
            } catch (error) {
                await replyToMessage(ctx, `❌ Could not find user @${username}`);
                return;
            }
        }
    }

    if (!targetUser) {
        await replyToMessage(ctx, 'Reply to a user\'s message or use /info @username.');
        return;
    }

    let statusStr = 'Unknown';
    try {
        const member = await ctx.getChatMember(targetUser.id);
        const statusMap: Record<string, string> = {
            creator: 'Creator',
            administrator: 'Administrator',
            member: 'Member',
            restricted: 'Restricted',
            left: 'Left',
            banned: 'Banned',
        };
        statusStr = statusMap[member.status] || 'Unknown';
    } catch (error) {
        statusStr = 'Unknown (bot may need admin rights)';
    }

    const userStats = loadUserStats();
    const key = (targetUser.username || '').toLowerCase();
    const escrowInfo = userStats[key] || { total_escrows: 0, total_amount: 0 };

    const msg =
        `👤 User Info\n` +
        `━━━━━━━━━━━━━━━\n` +
        `🆔 ID: ${targetUser.id}\n` +
        `📛 First Name: ${targetUser.first_name || 'N/A'}\n` +
        `📛 Last Name: ${targetUser.last_name || 'N/A'}\n` +
        `👤 Username: @${targetUser.username || 'N/A'}\n` +
        `🔗 User link: tg://user?id=${targetUser.id}\n` +
        `📌 Status in group: ${statusStr}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `✅ Total Escrows: ${escrowInfo.total_escrows}\n` +
        `💰 Escrow Amount: ₹${escrowInfo.total_amount}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `⚙️ Powered by @MRIXDUX`;

    await replyToMessage(ctx, msg);
});

// ==================== ERROR HANDLING ====================

bot.catch((err: any, ctx: any) => {
    console.error(`Error:`, err);
    ctx.reply('An error occurred.').catch(() => {});
});

// ==================== START BOT ====================

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is not set!');
    process.exit(1);
}

bot.launch()
    .then(() => {
        console.log('🚀 Escrow Bot is running (TypeScript version)');
        console.log(`📱 Bot username: @${bot.botInfo?.username}`);
    })
    .catch((err) => {
        console.error('Failed to start bot:', err);
        process.exit(1);
    });

// Graceful shutdown
process.once('SIGINT', () => {
    bot.stop('SIGINT');
    server.close(() => {
        console.log('🛑 Server closed');
        process.exit(0);
    });
});

process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    server.close(() => {
        console.log('🛑 Server closed');
        process.exit(0);
    });
});
