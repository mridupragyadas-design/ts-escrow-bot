import { Telegraf } from 'telegraf';
import { webhookCallback } from 'telegraf/express';
import fs from 'fs-extra';

// ==================== CONFIG ====================
// BOT_TOKEN is set as a Cloudflare Worker secret (wrangler secret put BOT_TOKEN)
// In development, you can use process.env.BOT_TOKEN
// For Cloudflare, it's passed via env

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
// Note: On Cloudflare Workers, file system is not available.
// You need to use Cloudflare KV or other storage.
// For now, we'll use in-memory (will reset on each deploy)
function loadStats(): Record<string, AdminStats> {
    // In production, use Cloudflare KV
    // For now, return empty object
    return {};
}

function saveStats(stats: Record<string, AdminStats>): void {
    // In production, save to Cloudflare KV
}

function loadUserStats(): Record<string, UserEscrowStats> {
    return {};
}

function saveUserStats(stats: Record<string, UserEscrowStats>): void {
    // In production, save to Cloudflare KV
}

function isAdmin(userId: number): boolean {
    return ADMINS.includes(userId) || userId === OWNER_ID;
}

// ==================== PENDING TRADES ====================
// On Cloudflare Workers, this will reset on each request.
// Use a database (KV, D1, or Supabase) for persistent storage.
const pendingTrades: Record<string, PendingTrade[]> = {};

// ==================== TELEGRAM BOT ====================
// We'll create the bot inside the fetch handler
// so it can access env variables

// ==================== BOT HANDLERS ====================
function setupBot(bot: Telegraf) {
    // Start command
    bot.start(async (ctx) => {
        await ctx.reply(
            '🤖 *Escrow Bot is running!*\n\n' +
            'Use `/help` to see available commands.',
            { parse_mode: 'Markdown' }
        );
    });

    // Help command
    bot.command('help', async (ctx) => {
        await ctx.reply(
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

    // Form handler (text or /form)
    bot.hears(/^(form|\/form|\/deal|deal)$/i, async (ctx) => {
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
        await ctx.reply(formMsg);
    });

    // /add command
    bot.command('add', async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
            await ctx.reply('⚠️ Only admins can add trades!');
            return;
        }

        const reply = ctx.message?.reply_to_message;
        if (!reply) {
            await ctx.reply('⚠️ Reply to a form message.');
            return;
        }

        const text = ('text' in reply && reply.text) ? reply.text : '';
        if (!text || !text.includes('Deal Info')) {
            await ctx.reply('⚠️ Invalid form message.');
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

        await ctx.reply(msg);
    });

    // /done command
    bot.command('done', async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
            await ctx.reply('⚠️ Only admins can release trades!');
            return;
        }

        const reply = ctx.message?.reply_to_message;
        if (!reply) {
            await ctx.reply('⚠️ Reply to trade message.');
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
            await ctx.reply('⚠️ Trade not found.');
            return;
        }

        // Admin stats
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

        // User escrow stats
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

        await ctx.reply(msg);
    });

    // /cancel command
    bot.command('cancel', async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
            await ctx.reply('⚠️ Only admins can cancel trades!');
            return;
        }

        const reply = ctx.message?.reply_to_message;
        if (!reply) {
            await ctx.reply('⚠️ Reply to trade message.');
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
            await ctx.reply('⚠️ Trade not found.');
            return;
        }

        const msg =
            `🔴 𝗧𝗿𝗮𝗱𝗲/𝗗𝗲𝗮𝗹 𝗖𝗮𝗻𝗰𝗲𝗹𝗹𝗲𝗱!!!!\n\n` +
            `👮🏻‍♂️ Cancelled By: @${ctx.from.username || 'Unknown'}\n` +
            `👨🏻‍💼 Buyer: ${tradeInfo.buyer}\n` +
            `🙎🏻‍♂️ Seller: ${tradeInfo.seller}\n\n` +
            `🔐 𝗖𝗥𝗘𝗔𝗧𝗘𝗗 𝗕𝗬 @MRIXDUX`;

        await ctx.reply(msg);
    });

    // /mydeals command
    bot.command('mydeals', async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
            await ctx.reply('⚠️ Admin only!');
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

        await ctx.reply(msg);
    });

    // /info command – supports both reply and @username
    bot.command('info', async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
            await ctx.reply('⚠️ Admin only!');
            return;
        }

        let targetUser: any = null;

        // Case 1: reply to a message
        if (ctx.message?.reply_to_message) {
            targetUser = ctx.message.reply_to_message.from;
        }
        // Case 2: /info @username
        else {
            const text = ctx.message?.text || '';
            const parts = text.split(' ');
            if (parts.length > 1) {
                const username = parts[1].replace('@', '');
                try {
                    // Fix: Use ctx.telegram.getChatMember with username
                    const chatMember = await ctx.telegram.getChatMember(ctx.chat.id, username);
                    targetUser = chatMember.user;
                } catch (error) {
                    await ctx.reply(`❌ Could not find user @${username}`);
                    return;
                }
            }
        }

        if (!targetUser) {
            await ctx.reply('Reply to a user\'s message or use /info @username.');
            return;
        }

        // Get group status
        let statusStr = 'Unknown';
        try {
            const member = await ctx.getChatMember(targetUser.id);
            const status = member.status;
            const statusMap: Record<string, string> = {
                creator: 'Creator',
                administrator: 'Administrator',
                member: 'Member',
                restricted: 'Restricted',
                left: 'Left',
                banned: 'Banned',
            };
            statusStr = statusMap[status] || 'Unknown';
        } catch (error) {
            statusStr = 'Unknown (bot may need admin rights)';
        }

        // Escrow stats
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

        await ctx.reply(msg);
    });

    // Error handling
    bot.catch((err, ctx) => {
        console.error(`Error for ${ctx.updateType}:`, err);
        ctx.reply('An error occurred while processing your request.').catch(() => {});
    });
}

// ==================== CLOUDFLARE WORKERS HANDLER ====================
export interface Env {
    BOT_TOKEN: string;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const bot = new Telegraf(env.BOT_TOKEN);
        setupBot(bot);

        // Handle webhook requests
        if (request.method === 'POST' && new URL(request.url).pathname === '/webhook') {
            return webhookCallback(bot, 'cloudflare-mod')(request);
        }

        // Health check
        if (request.url === new URL(request.url).origin + '/') {
            return new Response('Bot is running!', { status: 200 });
        }

        return new Response('Not found', { status: 404 });
    }
};
