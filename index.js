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
const SERVER_ID = '1469423215196770468';
const VERIFY_CHANNEL_ID = '1469452854535258232';
const SELECT_CHANNEL_ID = '1470015706107084895';

// ===================== AUTO ROLE =====================
client.on('guildMemberAdd', async (member) => {
  try {

    const guild = member.guild;

    const bannedRole = guild.roles.cache.find(r => r.name === 'banned');
    const activationRole = guild.roles.cache.find(r => r.name === 'Activation required');
    const memberRole = guild.roles.cache.find(r => r.name === 'member');

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
      content: '🎓 اضغط للتحقق عبر الإيميل الجامعي',
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('verify_start')
            .setLabel('Verify 🎓')
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

  const allowedChannel = "1478160543230595193";
  const roleID = "1480535231479025776";

  if (message.channel.id !== allowedChannel) return;

  if (message.content === '!java ABC123') {

    if (message.member.roles.cache.has(roleID)) {
      return message.reply("أنت تملك الرول بالفعل.");
    }

    await message.member.roles.add(roleID);

    message.reply("تم إعطاؤك رول طالب الجافا ✅");

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

      return interaction.showModal(modal).catch(() => {});

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
    if (interaction.isButton() && ['ban_user','unban_user'].includes(interaction.customId)) {

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

  } catch (err) {
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

    const activationRole = guild.roles.cache.find(r => r.name === 'Activation required');
    const memberRole = guild.roles.cache.find(r => r.name === 'member');

    if (activationRole && member.roles.cache.has(activationRole.id)) {
      await member.roles.remove(activationRole);
    }

    if (memberRole && !member.roles.cache.has(memberRole.id)) {
      await member.roles.add(memberRole);
    }

    verificationCodes.delete(message.author.id);

    return message.reply(
`🎉 تم تفعيل حسابك بنجاح — مرحبًا بك!
https://discord.gg/VF3Kr2Rbta`
    );

  }

});

// ===================== LOGIN =====================
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
