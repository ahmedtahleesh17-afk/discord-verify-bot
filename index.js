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

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.SENDGRID_API_KEY
  }
});

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
const SERVER_ID         = '1469423215196770468';
const VERIFY_CHANNEL_ID = '1480579307783852165';
const SELECT_CHANNEL_ID = '1481824622394609754';

// ===================== AUTO ROLE =====================
client.on('guildMemberAdd', async (member) => {
  try {

    const guild = member.guild;

    const bannedRole     = guild.roles.cache.find(r => r.name === '‼️┃Banned');
    const activationRole = guild.roles.cache.find(r => r.name === '❌┃Active');
    const memberRole     = guild.roles.cache.find(r => r.name === '🙋┃ Member');

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
            .setCustomId('activate_user')
            .setLabel('⚡ Activate User')
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });

  } catch (err) {
    console.error('Panel error:', err);
  }

});

// ===================== JAVA & PS ROLE COMMANDS =====================
client.on('messageCreate', async (message) => {

  if (message.author.bot) return;

  const allowedChannel = '1479822682412552313';
  const javaRoleID     = '1480535231479025776';
  const psRoleID       = '1486367831368138853';

  if (message.channel.id !== allowedChannel) return;

  // ===== JAVA =====
  if (message.content === '!java.IT&AI-2026') {

    if (message.member.roles.cache.has(javaRoleID)) {
      await message.delete().catch(() => {});
      const reply = await message.channel.send({
        content: `✅ ${message.author} أنت تملك الرول بالفعل.`
      });
      setTimeout(() => reply.delete().catch(() => {}), 10000);
      return;
    }

    await message.member.roles.add(javaRoleID);
    await message.delete().catch(() => {});

    const reply = await message.channel.send({
      content: `✅ ${message.author} تم إعطاؤك رول طالب الجافا`
    });
    setTimeout(() => reply.delete().catch(() => {}), 10000);
  }

  // ===== PROBLEM SOLVING =====
  if (message.content === '!ps.IT&AI-2026') {

    if (message.member.roles.cache.has(psRoleID)) {
      await message.delete().catch(() => {});
      const reply = await message.channel.send({
        content: `✅ ${message.author} أنت تملك الرول بالفعل.`
      });
      setTimeout(() => reply.delete().catch(() => {}), 10000);
      return;
    }

    await message.member.roles.add(psRoleID);
    await message.delete().catch(() => {});

    const reply = await message.channel.send({
      content: `✅ ${message.author} تم إعطاؤك رول Problem Solving`
    });
    setTimeout(() => reply.delete().catch(() => {}), 10000);
  }

});

// ===================== INTERACTIONS =====================
client.on(Events.InteractionCreate, async (interaction) => {

  try {

    // ================= VERIFY START =================
    if (interaction.isButton() && interaction.customId === 'verify_start') {

      const modal = new ModalBuilder()
        .setCustomId('username_modal')
        .setTitle('🎓 Verify Account');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('username_input')
            .setLabel('Enter your university username')
            .setPlaceholder('example: s.r.hjase')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    // ================= ENTER CODE BUTTON =================
    if (interaction.isButton() && interaction.customId === 'enter_code') {

      const userData = verificationCodes.get(interaction.user.id);

      if (!userData) {
        return interaction.reply({ content: '❌ لازم تطلب كود أول', flags: 64 });
      }

      const codeModal = new ModalBuilder()
        .setCustomId('code_modal')
        .setTitle('📧 Enter Code');

      codeModal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('code_input')
            .setLabel('Enter the code')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(codeModal);
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
            .setPlaceholder('example: 123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal).catch(() => {});
    }

    // ================= EMAIL LOOKUP MODAL =================
    if (interaction.isModalSubmit() && interaction.customId === 'email_lookup_modal') {

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
      }

      const userId = interaction.fields.getTextInputValue('discord_id_input').trim();

      if (!/^\d+$/.test(userId)) {
        return interaction.editReply('❌ الرجاء إدخال Discord ID رقمي صحيح');
      }

      const [rows] = await db.query(
        'SELECT email FROM verified_users WHERE discord_id = ?',
        [userId]
      );

      if (!rows.length) {
        return interaction.editReply('❌ لا يوجد إيميل مرتبط بهذا الـ ID');
      }

      return interaction.editReply(`📧 الإيميل الجامعي:\n**${rows[0].email}**`);
    }

    // ================= USERNAME MODAL =================
    if (interaction.isModalSubmit() && interaction.customId === 'username_modal') {

      // ✅ رد فوري على Discord قبل أي عملية
      await interaction.deferReply({ flags: 64 });

      const username = interaction.fields.getTextInputValue('username_input').trim();

      if (!/^[a-zA-Z0-9.]+$/.test(username)) {
        return interaction.editReply('❌ Username غير صالح');
      }

      const email = `${username}@students.ptuk.edu.ps`;

      const [exists] = await db.query(
        'SELECT discord_id FROM verified_users WHERE email = ?',
        [email]
      );

      if (exists.length) {
        return interaction.editReply('❌ هذا الإيميل مستخدم بالفعل');
      }

      const code = Math.floor(100000 + Math.random() * 900000);

      verificationCodes.set(interaction.user.id, { code, email });

      try {
        await transporter.sendMail({
          to: email,
          from: process.env.EMAIL_USER,
          subject: 'PTUK Verification Code',
          html: `<h2>رمز التحقق</h2><h1>${code}</h1>`
        });
      } catch (err) {
        console.error('Gmail Error:', err.message);
        verificationCodes.delete(interaction.user.id);
        return interaction.editReply('❌ فشل إرسال الإيميل');
      }

      return interaction.editReply({
        content: '📧 تم إرسال كود التحقق إلى بريدك',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('enter_code')
              .setLabel('✍️ Enter Code')
              .setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }

    // ================= CODE MODAL =================
    if (interaction.isModalSubmit() && interaction.customId === 'code_modal') {

      await interaction.deferReply({ flags: 64 });

      const userData = verificationCodes.get(interaction.user.id);

      if (!userData) {
        return interaction.editReply('❌ انتهت الجلسة، حاول مرة أخرى');
      }

      const enteredCode = interaction.fields.getTextInputValue('code_input');

      if (enteredCode !== userData.code.toString()) {
        return interaction.editReply('❌ الكود خاطئ');
      }

      const guild  = await client.guilds.fetch(SERVER_ID);
      const member = await guild.members.fetch(interaction.user.id);

      await db.query(
        `INSERT INTO verified_users (discord_id, email, banned)
         VALUES (?, ?, 0)
         ON DUPLICATE KEY UPDATE email = VALUES(email)`,
        [interaction.user.id, userData.email]
      );

      const activationRole = guild.roles.cache.find(r => r.name === '❌┃Active');
      const memberRole     = guild.roles.cache.find(r => r.name === '🙋┃ Member');

      if (activationRole && member.roles.cache.has(activationRole.id)) {
        await member.roles.remove(activationRole);
      }

      if (memberRole && !member.roles.cache.has(memberRole.id)) {
        await member.roles.add(memberRole);
      }

      verificationCodes.delete(interaction.user.id);

      return interaction.editReply('🎉 تم التفعيل بنجاح!');
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

      return interaction.showModal(modal).catch(() => {});
    }

    // ================= BAN MODAL =================
    if (interaction.isModalSubmit() && interaction.customId === 'ban_modal') {

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
      }

      return handleBan(interaction, interaction.fields.getTextInputValue('input'));
    }

    // ================= UNBAN MODAL =================
    if (interaction.isModalSubmit() && interaction.customId === 'unban_modal') {

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
      }

      return handleUnban(interaction, interaction.fields.getTextInputValue('input'));
    }

    // ================= ACTIVATE USER BUTTON =================
    if (interaction.isButton() && interaction.customId === 'activate_user') {

      if (interaction.deferred || interaction.replied) return;

      const modal = new ModalBuilder()
        .setCustomId('activate_modal')
        .setTitle('⚡ Activate User');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('activate_discord_id')
            .setLabel('Discord ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('activate_email')
            .setLabel('University Email (username only)')
            .setPlaceholder('example: s.r.hjase')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal).catch(() => {});
    }

    // ================= ACTIVATE USER MODAL =================
    if (interaction.isModalSubmit() && interaction.customId === 'activate_modal') {

      await interaction.deferReply({ flags: 64 });

      const discordId = interaction.fields.getTextInputValue('activate_discord_id').trim();
      const username  = interaction.fields.getTextInputValue('activate_email').trim();
      const email     = username.includes('@') ? username : `${username}@students.ptuk.edu.ps`;

      const [emailCheck] = await db.query(
        'SELECT discord_id FROM verified_users WHERE email = ?',
        [email]
      );

      if (emailCheck.length && emailCheck[0].discord_id !== discordId) {
        return interaction.editReply('❌ هذا الإيميل مرتبط بحساب آخر');
      }

      const guild  = await client.guilds.fetch(SERVER_ID);
      const member = await guild.members.fetch(discordId).catch(() => null);

      if (!member) {
        return interaction.editReply('❌ المستخدم غير موجود في السيرفر');
      }

      const activationRole = guild.roles.cache.find(r => r.name === '❌┃Active');
      const memberRole     = guild.roles.cache.find(r => r.name === '🙋┃ Member');

      try {

        if (activationRole && member.roles.cache.has(activationRole.id)) {
          await member.roles.remove(activationRole);
        }

        if (memberRole && !member.roles.cache.has(memberRole.id)) {
          await member.roles.add(memberRole);
        }

        await db.query(
          `INSERT INTO verified_users (discord_id, email, banned)
           VALUES (?, ?, 0)
           ON DUPLICATE KEY UPDATE email = VALUES(email)`,
          [discordId, email]
        );

        return interaction.editReply(`✅ تم تفعيل ${member.user.tag} بنجاح`);

      } catch (err) {
        console.error('Activate error:', err);
        return interaction.editReply('❌ فشل التفعيل');
      }
    }

  } catch (err) {
    console.error('Interaction error:', err);
  }

});

// ===================== BAN FUNCTION =====================
async function handleBan(interaction, input) {

  const guild = await client.guilds.fetch(SERVER_ID);
  let member  = null;

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

  if (!member) return interaction.editReply('❌ المستخدم غير موجود');

  const bannedRole     = guild.roles.cache.find(r => r.name === '‼️┃Banned');
  const activationRole = guild.roles.cache.find(r => r.name === '❌┃Active');
  const memberRole     = guild.roles.cache.find(r => r.name === '🙋┃ Member');

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
  let member  = null;

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

  if (!member) return interaction.editReply('❌ المستخدم غير موجود');

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
