const { Client, GatewayIntentBits } = require('discord.js');

// Bot erstellen mit notwendigen Intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// Konfiguration - diese Werte sollten als Umgebungsvariablen gesetzt werden
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID; // ID des Voice Channels, der überwacht werden soll
const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID; // ID des Text Channels für Benachrichtigungen
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID; // ID der Server-Personal Rolle

// Ticket-Kategorien IDs
const TICKET_CATEGORIES = [
    '1413669641062055976',
    '1413669733957636156', 
    '1413669821375189032',
    '1413892803162800178',
    '1413893025620299837'
];

// Hilfsfunktion: Prüfen ob User ein offenes Ticket hat
async function checkForOpenTickets(member, guild) {
    try {
        let openTickets = [];
        
        for (const categoryId of TICKET_CATEGORIES) {
            const category = guild.channels.cache.get(categoryId);
            if (!category) continue;
            
            const channels = category.children.cache;
            for (const [channelId, channel] of channels) {
                // Prüfen ob der Channel-Name den Usernamen enthält (häufiges Ticket-Format)
                if (channel.name.toLowerCase().includes(member.user.username.toLowerCase()) ||
                    channel.name.toLowerCase().includes(member.displayName.toLowerCase())) {
                    openTickets.push({
                        name: channel.name,
                        category: category.name,
                        url: `https://discord.com/channels/${guild.id}/${channelId}`
                    });
                }
            }
        }
        
        return openTickets;
    } catch (error) {
        console.error('Fehler beim Überprüfen der Tickets:', error);
        return [];
    }
}

// Bot bereit Event
client.once('ready', () => {
    console.log(`Bot ist eingeloggt als ${client.user.tag}!`);
    console.log(`Überwache Voice Channel: ${VOICE_CHANNEL_ID}`);
    console.log(`Benachrichtigungen in Channel: ${NOTIFICATION_CHANNEL_ID}`);
    console.log(`Pinge Rolle: ${STAFF_ROLE_ID}`);
});

// Voice State Update Event - wird ausgelöst wenn jemand einen Voice Channel betritt/verlässt
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const notificationChannel = client.channels.cache.get(NOTIFICATION_CHANNEL_ID);
        
        if (!notificationChannel) {
            console.error(`Benachrichtigungs-Channel mit ID ${NOTIFICATION_CHANNEL_ID} nicht gefunden!`);
            return;
        }

        // Prüfen ob jemand den überwachten Voice Channel betritt
        if (newState.channelId === VOICE_CHANNEL_ID && oldState.channelId !== VOICE_CHANNEL_ID) {
            const member = newState.member;
            const voiceChannel = newState.channel;

            // Nachricht für Beitritt senden
            const timestamp = new Date().toLocaleString('de-DE', { 
                timeZone: 'Europe/Berlin',
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            // Prüfen auf offene Tickets
            const openTickets = await checkForOpenTickets(member, newState.guild);
            let ticketInfo = '';
            if (openTickets.length > 0) {
                ticketInfo = `\u001b[33m🎫 Tickets:  \u001b[31m${openTickets.length} OPEN TICKET(S)\u001b[0m\n`;
                for (const ticket of openTickets) {
                    ticketInfo += `\u001b[33m         ↳ \u001b[37m${ticket.name} (${ticket.category})\u001b[0m\n`;
                }
            } else {
                ticketInfo = `\u001b[33m🎫 Tickets:  \u001b[32mNO OPEN TICKETS\u001b[0m\n`;
            }
            
            const joinMessage = `🟢 **VOICE CHANNEL ALERT** 🟢\n` +
                              `\`\`\`ansi\n\u001b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m\n` +
                              `\u001b[1;36m🔊 NEW USER JOINED\u001b[0m\n` +
                              `\u001b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m\n` +
                              `\u001b[33m⏰ Time:     \u001b[37m${timestamp}\u001b[0m\n` +
                              `\u001b[33m👤 User:     \u001b[37m${member.displayName}\u001b[0m\n` +
                              `\u001b[33m🏠 Channel:  \u001b[37m${voiceChannel.name}\u001b[0m\n` +
                              ticketInfo +
                              `\u001b[33m📋 Status:   \u001b[31m⚠️  WAITING FOR TEAM RESPONSE\u001b[0m\n` +
                              `\u001b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m\n\`\`\`\n` +
                              `<@&${STAFF_ROLE_ID}> 🚨 **Immediate attention required!**`;

            await notificationChannel.send(joinMessage);
            console.log(`Benachrichtigung gesendet: ${member.displayName} ist ${voiceChannel.name} beigetreten`);
        }

        // Prüfen ob jemand den überwachten Voice Channel verlässt
        if (oldState.channelId === VOICE_CHANNEL_ID && newState.channelId !== VOICE_CHANNEL_ID) {
            const member = oldState.member;
            const oldVoiceChannel = oldState.channel;
            
            let leaveMessage;
            
            // Timestamp für Leave-Nachricht
            const timestamp = new Date().toLocaleString('de-DE', { 
                timeZone: 'Europe/Berlin',
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            // Unterscheiden zwischen Disconnect und Move zu anderem Channel
            if (newState.channelId === null) {
                // User hat komplett disconnectet
                leaveMessage = `🔴 **VOICE CHANNEL UPDATE** 🔴\n` +
                             `\`\`\`ansi\n\u001b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m\n` +
                             `\u001b[1;31m🔌 USER DISCONNECTED\u001b[0m\n` +
                             `\u001b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m\n` +
                             `\u001b[33m⏰ Time:     \u001b[37m${timestamp}\u001b[0m\n` +
                             `\u001b[33m👤 User:     \u001b[37m${member.displayName}\u001b[0m\n` +
                             `\u001b[33m📤 From:     \u001b[37m${oldVoiceChannel.name}\u001b[0m\n` +
                             `\u001b[33m❌ Action:   \u001b[31mDISCONNECTED\u001b[0m\n` +
                             `\u001b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m\n\`\`\``;
            } else {
                // User wurde in einen anderen Channel gemoved
                const newVoiceChannel = newState.channel;
                
                leaveMessage = `🟡 **VOICE CHANNEL UPDATE** 🟡\n` +
                             `\`\`\`ansi\n\u001b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m\n` +
                             `\u001b[1;33m🔄 USER MOVED\u001b[0m\n` +
                             `\u001b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m\n` +
                             `\u001b[33m⏰ Time:     \u001b[37m${timestamp}\u001b[0m\n` +
                             `\u001b[33m👤 User:     \u001b[37m${member.displayName}\u001b[0m\n` +
                             `\u001b[33m📤 From:     \u001b[37m${oldVoiceChannel.name}\u001b[0m\n` +
                             `\u001b[33m📥 To:       \u001b[37m${newVoiceChannel.name}\u001b[0m\n` +
                             `\u001b[33m🔄 Action:   \u001b[36mMOVED\u001b[0m\n` +
                             `\u001b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m\n\`\`\``;
            }

            await notificationChannel.send(leaveMessage);
            console.log(`Leave-Benachrichtigung gesendet: ${member.displayName}`);
        }
    } catch (error) {
        console.error('Fehler beim Verarbeiten des Voice State Updates:', error);
    }
});

// Fehlerbehandlung
client.on('error', (error) => {
    console.error('Discord Client Fehler:', error);
});

client.on('warn', (warning) => {
    console.warn('Discord Client Warnung:', warning);
});

// Bot einloggen
if (!DISCORD_TOKEN) {
    console.error('DISCORD_TOKEN Umgebungsvariable ist nicht gesetzt!');
    process.exit(1);
}

client.login(DISCORD_TOKEN).catch(error => {
    console.error('Fehler beim Einloggen des Bots:', error);
    process.exit(1);
});