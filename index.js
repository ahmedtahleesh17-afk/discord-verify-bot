require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} = require('discord.js');

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const mysql = require('mysql2/promise');

// ===================== CLIENT =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: ['CHANNEL']
});

// ===================== DATABASE =====================
const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: Number(process.env.MYSQL_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 5
});

// اختبار الاتصال
(async () => {
  try {
    await db.query("SELECT 1");
    console.log("✅ MySQL Connected Successfully");
  } catch (err) {
    console.error("❌ MySQL Connection Failed:", err.message);
  }
})();

// ===================== TEMP STORAGE =====================
const verificationCodes = new Map();

// ===================== SERVER SETTINGS =====================
const SERVER_ID = '1469423215196770468';//تعديل
const VERIFY_CHANNEL_ID = '1480579307783852165';//تعديل
const SELECT_CHANNEL_ID = '1481824622394609754';//تعديل

// ===================== AUTO ROLE =====================
client.on('guildMemberAdd', async (member) => {
  try {

    const guild = member.guild;

    const bannedRole = guild.roles.cache.find(r => r.name === '‼️┃Banned');
    const activationRole = guild.roles.cache.find(r => r.name === '❌┃Active');
    const memberRole = guild.roles.cache.find(r => r.name === '🙋┃ Member');

    const [rows] = await db.query(
      'SELECT banned FROM verified_users WHERE discord_id = ?',
      [member.id]
    );

    if (rows.length && rows[0].banned == 1) {
      if (bannedRole) await member.roles.add(bannedRole);
      return;
    }

    if (rows.length && rows[0].banned == 0) {
      if (memberRole) await member.roles.add(memberRole);
      return;
    }

    if (activationRole && !member.roles.cache.has(activationRole.id)) {
      await member.roles.add(activationRole);
    }

  } catch (err) {
    console.error('Join error:', err);
  }
});

// ===================== READY =====================
client.once(Events.ClientReady, async () => {

  console.log(`✅ Bot online as ${client.user.tag}`);

  try {

    const verifyChannel = await client.channels.fetch(VERIFY_CHANNEL_ID);
    const selectChannel = await client.channels.fetch(SELECT_CHANNEL_ID);

    await verifyChannel.send({
      content: '**فعل حسابك في مجتمع لجنة تكنولوجيا المعلومات والذكاء الأصطناعي**',
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('verify_start')
            .setLabel('🧑‍🎓┃Verify')
            .setStyle(ButtonStyle.Success)
        )
      ]
    });

    await selectChannel.send({
  content: '🛠️ أدوات الإدارة والتحكم بالمستخدمين',
  components: [

    new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId('get_email')
        .setLabel('📧 Get Student Email')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('ban_user')
        .setLabel('🚫 Ban User')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId('unban_user')
        .setLabel('✅ Unban User')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId('switch_roles')
        .setLabel('🔄 Switch Roles')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('close_server')
        .setLabel('🔧 Close Server')
        .setStyle(ButtonStyle.Danger)

    ),

    new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId('open_server')
        .setLabel('🟢 Open Server')
        .setStyle(ButtonStyle.Success)

    )

  ]
});

  } catch (err) {
    console.error('Panel error:', err);
  }

});

// ===================== JAVA ROLE COMMAND =====================
client.on('messageCreate', async (message) => {

  if (message.author.bot) return;

  const allowedChannel = "1479822682412552313";
  const roleID = "1480535231479025776";

  if (message.channel.id !== allowedChannel) return;

  if (message.content === '!java.IT&AI-2026') {

    if (message.member.roles.cache.has(roleID)) {

      await message.delete().catch(() => { });

      const reply = await message.channel.send({
        content: `✅ ${message.author} أنت تملك الرول بالفعل.`
      });

      // حذف الرسالة بعد 10 ثواني
      setTimeout(() => reply.delete().catch(() => { }), 10000);

      return;
    }

    await message.member.roles.add(roleID);

    // حذف رسالة الكود
    await message.delete().catch(() => { });

    const reply = await message.channel.send({
      content: `✅ ${message.author} تم إعطاؤك رول طالب الجافا`
    });

    // حذف رسالة التأكيد بعد 10 ثواني
    setTimeout(() => {
      reply.delete().catch(() => { });
    }, 10000);

  }

});

// ===================== PS ROLE COMMAND =====================

client.on('messageCreate', async (message) => {

  if (message.author.bot) return;

  const allowedChannel = "1479822682412552313"; // نفس الروم
  const roleID = "1486367831368138853"; // رول Problem Solving

  if (message.channel.id !== allowedChannel) return;

  if (message.content === '!ps.IT&AI-2026') { // غيرت الكود عشان يختلف

    if (message.member.roles.cache.has(roleID)) {

      await message.delete().catch(() => { });

      const reply = await message.channel.send({
        content: `✅ ${message.author} أنت تملك الرول بالفعل.`
      });

      setTimeout(() => reply.delete().catch(() => { }), 10000);
      return;
    }

    await message.member.roles.add(roleID);

    await message.delete().catch(() => { });

    const reply = await message.channel.send({
      content: `✅ ${message.author} تم إعطاؤك رول Problem Solving`
    });

    setTimeout(() => {
      reply.delete().catch(() => { });
    }, 10000);

  }

});

// ===================== INTERACTIONS =====================

client.on(Events.InteractionCreate, async (interaction) => {

  try {

    // ================= VERIFY BUTTON =================
    if (interaction.isButton() && interaction.customId === 'verify_start') {

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
      }

      try {

        await interaction.user.send(
          `📹 **شاهد الفيديو التعريفي لطريقة تفعيل حسابك في السيرفر:**
https://www.youtube.com/shorts/MsUS0BXnjjE`
        );

        await interaction.user.send(
          `🎓 **أرسل إيميلك الجامعي:**
\`name@students.ptuk.edu.ps\``
        );

        verificationCodes.set(interaction.user.id, { step: 'email' });

        return interaction.editReply('📩 تم إرسال رسالة في الخاص');

      } catch {
        return interaction.editReply('❌ افتح الخاص مع البوت أولاً');
      }

    }

    // ================= GET EMAIL BUTTON =================
    if (interaction.isButton() && interaction.customId === 'get_email') {

      if (interaction.deferred || interaction.replied) return;

      const modal = new ModalBuilder()
        .setCustomId('email_lookup_modal')
        .setTitle('📧 Get Student Email');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('discord_id_input')
            .setLabel('Discord User ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal).catch(() => { });

    }

    // ================= EMAIL LOOKUP =================
    if (interaction.isModalSubmit() && interaction.customId === 'email_lookup_modal') {

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
      }

      const userId = interaction.fields.getTextInputValue('discord_id_input');

      const [rows] = await db.query(
        'SELECT email FROM verified_users WHERE discord_id = ?',
        [userId]
      );

      if (!rows.length) {
        return interaction.editReply('❌ لا يوجد إيميل مرتبط');
      }

      return interaction.editReply(`📧 الإيميل الجامعي:\n**${rows[0].email}**`);

    }

    // ================= BAN / UNBAN BUTTON =================
    if (interaction.isButton() && ['ban_user', 'unban_user'].includes(interaction.customId)) {

      if (interaction.deferred || interaction.replied) return;

      const modal = new ModalBuilder()
        .setCustomId(interaction.customId === 'ban_user' ? 'ban_modal' : 'unban_modal')
        .setTitle(interaction.customId === 'ban_user' ? '🚫 Ban User' : '✅ Unban User');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('input')
            .setLabel('Discord ID أو Email جامعي')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal).catch(() => { });

    }

    // ================= BAN =================
    if (interaction.isModalSubmit() && interaction.customId === 'ban_modal') {

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
      }

      return handleBan(interaction, interaction.fields.getTextInputValue('input'));

    }

    // ================= UNBAN =================
    if (interaction.isModalSubmit() && interaction.customId === 'unban_modal') {

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
      }

      return handleUnban(interaction, interaction.fields.getTextInputValue('input'));

    }
    // ================= CLOSE SERVER =================
    if (interaction.isButton() && interaction.customId === 'close_server') {

      await interaction.deferReply({ flags: 64 });

      const guild = interaction.guild;

      const closedRole = guild.roles.cache.find(r => r.name === "closed");

      if (!closedRole)
        return interaction.editReply("❌ Role 'closed' not found");

      let count = 0;

      for (const member of guild.members.cache.values()) {

        if (!member.roles.cache.has(closedRole.id)) {

          try {

            await member.roles.add(closedRole);
            count++;

            await new Promise(r => setTimeout(r, 300));

          } catch { }

        }

      }

      interaction.editReply(`🔧 Server closed\n${count} members updated`);

    }
    // ================= OPEN SERVER =================
    if (interaction.isButton() && interaction.customId === 'open_server') {

      await interaction.deferReply({ flags: 64 });

      const guild = interaction.guild;

      const closedRole = guild.roles.cache.find(r => r.name === "closed");

      if (!closedRole)
        return interaction.editReply("❌ Role 'closed' not found");

      let count = 0;

      for (const member of guild.members.cache.values()) {

        if (member.roles.cache.has(closedRole.id)) {

          try {

            await member.roles.remove(closedRole);
            count++;

            await new Promise(r => setTimeout(r, 300));

          } catch { }

        }

      }

      interaction.editReply(`🟢 Server opened\n${count} members updated`);

    }
    // ================= SWITCH ROLES =================
    if (interaction.isButton() && interaction.customId === 'switch_roles') {

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
      }

      const guild = await client.guilds.fetch(SERVER_ID);
      await guild.members.fetch();

      const roleMap = {

        "Leader": "👸┃Real Leader",
        "Co-Leader": "🫅┃Real Co-Leader",
        "Scientific Committee": "♾️┃Scientific Committee",
        "Media Committee": "🎬┃Media Committee",
        "Activities Committee": "🤹┃Activities Committee",
        "Support": "🎗️┃Support Committee",
        "banned": "‼️┃Banned",
        "Coach": "🧑‍🏫┃Teacher",
        "Activation required": "❌┃Active",
        "Graduate": "🎖️┃Graduate",
        "Fourth Year": "🏅┃4th",
        "Third Year": "🥉┃3rd",
        "Second Year": "🥈┃2nd",
        "First Year": "🥇┃1st",
        "Artificial intelligence": "🤖┃Artificial Intelligence",
        "Computer science": "💻┃Computer Scince",
        "Information security": "🛡️┃Information Security",
        "Other": "❇️┃Other",
        "Male": "♂️┃Male",
        "Female": "♀️┃Female",
        "member": "🙋┃ Member",
        "BOTS": "🎰┃Bots",
        "Admin": "🧑‍🔧┃Moderator",
        "Committee": "👥┃Real Committee",
      };

      let switched = 0;

      for (const member of guild.members.cache.values()) {

        for (const oldRoleName in roleMap) {

          const newRoleName = roleMap[oldRoleName];

          const oldRole = guild.roles.cache.find(r => r.name === oldRoleName);
          const newRole = guild.roles.cache.find(r => r.name === newRoleName);

          if (!oldRole || !newRole) continue;

          if (member.roles.cache.has(oldRole.id)) {

            try {

              await member.roles.remove(oldRole);
              await member.roles.add(newRole);

              switched++;

            } catch { }

          }

        }

      }

      return interaction.editReply(`✅ تم استبدال ${switched} رول`);

    }

  }


  catch (err) {
    console.error('Interaction error:', err);
  }

});

// ===================== PRIVATE VERIFY =====================

client.on('messageCreate', async (message) => {

  if (message.author.bot || message.guild) return;

  const userData = verificationCodes.get(message.author.id);
  if (!userData) return;

  // ================= EMAIL STEP =================
  if (userData.step === 'email') {

    const email = message.content.trim();

    if (!email.endsWith('@students.ptuk.edu.ps')) {
      return message.reply('❌ استخدم الإيميل الجامعي فقط');
    }

    const [exists] = await db.query(
      'SELECT discord_id FROM verified_users WHERE email = ?',
      [email]
    );

    if (exists.length) {
      return message.reply('❌ هذا الإيميل مستخدم بالفعل');
    }

    const code = Math.floor(100000 + Math.random() * 900000);

    verificationCodes.set(message.author.id, {
      step: 'code',
      code,
      email
    });

    try {

      await sgMail.send({
        to: email,
        from: process.env.EMAIL_USER,
        subject: 'PTUK Verification Code',
        html: `<h2>رمز التحقق</h2><h1>${code}</h1>`
      });

      return message.reply(
        `📨 تم إرسال كود التحقق إلى بريدك الجامعي

**ملاحظة: يرجى التحقق من قسم البريد غير الهام (Junk/Spam) فقد تجد الرمز هناك.**`
      );

    } catch {

      verificationCodes.delete(message.author.id);
      return message.reply('❌ فشل إرسال الإيميل — أبلغ الإدارة.');

    }

  }

  // ================= CODE STEP =================
  if (userData.step === 'code') {

    if (message.content.trim() !== userData.code.toString()) {
      return message.reply('❌ الكود خاطئ');
    }

    const guild = await client.guilds.fetch(SERVER_ID);
    const member = await guild.members.fetch(message.author.id).catch(() => null);

    if (!member) {
      return message.reply('❌ يجب أن تكون داخل السيرفر');
    }

    await db.query(
      `INSERT INTO verified_users (discord_id, email, banned)
VALUES (?, ?, 0)
ON DUPLICATE KEY UPDATE email = VALUES(email)`,
      [message.author.id, userData.email]
    );

    const activationRole = guild.roles.cache.find(r => r.name === '❌┃Active');
    const memberRole = guild.roles.cache.find(r => r.name === '🙋┃ Member');

    if (activationRole && member.roles.cache.has(activationRole.id)) {
      await member.roles.remove(activationRole);
    }

    if (memberRole && !member.roles.cache.has(memberRole.id)) {
      await member.roles.add(memberRole);
    }

    verificationCodes.delete(message.author.id);

    return message.reply(
      `🎉 تم تفعيل حسابك بنجاح — مرحبًا بك!
https://discord.gg/duFDsDzvAf`
    );

  }

});

// ===================== BAN FUNCTION =====================
async function handleBan(interaction, input) {

  const guild = await client.guilds.fetch(SERVER_ID);
  let member = null;

  if (/^\d+$/.test(input)) {
    member = await guild.members.fetch(input).catch(() => null);
  }

  const [rows] = await db.query(
    'SELECT discord_id FROM verified_users WHERE email = ?',
    [input]
  );

  if (!member && rows.length) {
    member = await guild.members.fetch(rows[0].discord_id).catch(() => null);
  }

  if (!member) {
    return interaction.editReply('❌ المستخدم غير موجود');
  }

  const bannedRole = guild.roles.cache.find(r => r.name === '‼️┃Banned');
  const activationRole = guild.roles.cache.find(r => r.name === '❌┃Active');
  const memberRole = guild.roles.cache.find(r => r.name === '🙋┃ Member');

  try {

    if (memberRole && member.roles.cache.has(memberRole.id)) {
      await member.roles.remove(memberRole);
    }

    if (activationRole && member.roles.cache.has(activationRole.id)) {
      await member.roles.remove(activationRole);
    }

    if (bannedRole && !member.roles.cache.has(bannedRole.id)) {
      await member.roles.add(bannedRole);
    }

    await db.query(
      'UPDATE verified_users SET banned = 1 WHERE discord_id = ?',
      [member.id]
    );

    return interaction.editReply(`🚫 تم حظر ${member.user.tag}`);

  } catch (err) {
    console.error('Ban error:', err);
    return interaction.editReply('❌ فشل تنفيذ الباند');
  }

}

// ===================== UNBAN FUNCTION =====================
async function handleUnban(interaction, input) {

  const guild = await client.guilds.fetch(SERVER_ID);
  let member = null;

  if (/^\d+$/.test(input)) {
    member = await guild.members.fetch(input).catch(() => null);
  }

  const [rows] = await db.query(
    'SELECT discord_id FROM verified_users WHERE email = ?',
    [input]
  );

  if (!member && rows.length) {
    member = await guild.members.fetch(rows[0].discord_id).catch(() => null);
  }

  if (!member) {
    return interaction.editReply('❌ المستخدم غير موجود');
  }

  const bannedRole = guild.roles.cache.find(r => r.name === '‼️┃Banned');
  const memberRole = guild.roles.cache.find(r => r.name === '🙋┃ Member');

  try {

    if (bannedRole && member.roles.cache.has(bannedRole.id)) {
      await member.roles.remove(bannedRole);
    }

    if (memberRole && !member.roles.cache.has(memberRole.id)) {
      await member.roles.add(memberRole);
    }

    await db.query(
      'UPDATE verified_users SET banned = 0 WHERE discord_id = ?',
      [member.id]
    );

    return interaction.editReply(`✅ تم فك الحظر عن ${member.user.tag}`);

  } catch (err) {
    console.error('Unban error:', err);
    return interaction.editReply('❌ فشل فك الحظر');
  }

}

// ===================== LOGIN =====================
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
