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
const mysql = require('mysql2/promise');

// ===================== CLIENT =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: ['CHANNEL']
});

// ===================== DATABASE =====================
const db = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===================== TEMP STORAGE =====================
const verificationCodes = new Map();

// ===================== EMAIL CONFIG =====================
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000
});

// اختبار SMTP عند التشغيل
transporter.verify((err) => {
  if (err) {
    console.error("❌ SMTP CONNECTION FAILED:", err.message);
  } else {
    console.log("✅ SMTP Ready to send emails");
  }
});

// ===================== SERVER SETTINGS =====================
const SERVER_ID = '1469423215196770468';
const VERIFY_CHANNEL_ID = '1469452854535258232';
const SELECT_CHANNEL_ID = '1470015706107084895';

// ===================== AUTO ROLE =====================
client.on('guildMemberAdd', async member => {
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
      if (bannedRole) await member.roles.set([bannedRole]);
      return;
    }

    if (rows.length) {
      if (memberRole) await member.roles.set([memberRole]);
      return;
    }

    if (activationRole) await member.roles.add(activationRole);

  } catch (err) {
    console.error('Join error:', err);
  }
});

// ===================== READY =====================
client.once('ready', async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);

  try {
    const verifyChannel = await client.channels.fetch(VERIFY_CHANNEL_ID);
    const selectChannel = await client.channels.fetch(SELECT_CHANNEL_ID);

    const verifyRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_start')
        .setLabel('Verify 🎓')
        .setStyle(ButtonStyle.Success)
    );

    await verifyChannel.send({
      content: '🎓 اضغط للتحقق عبر الإيميل الجامعي',
      components: [verifyRow]
    });

    const selectRow = new ActionRowBuilder().addComponents(
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
    );

    await selectChannel.send({
      content: '🛠️ أدوات الإدارة والتحكم بالمستخدمين',
      components: [selectRow]
    });

  } catch (err) {
    console.error('Panel error:', err);
  }
});

// ===================== INTERACTIONS =====================
client.on(Events.InteractionCreate, async interaction => {
  try {

    if (interaction.isButton() && interaction.customId === 'verify_start') {
      try {
        await interaction.user.send(
          '🎓 أرسل إيميلك الجامعي:\n`name@students.ptuk.edu.ps`'
        );

        verificationCodes.set(interaction.user.id, { step: 'email' });

        return interaction.reply({
          content: '📩 تم إرسال رسالة في الخاص',
          ephemeral: true
        });

      } catch {
        return interaction.reply({
          content: '❌ افتح الخاص مع البوت أولاً',
          ephemeral: true
        });
      }
    }

    if (interaction.isButton() && interaction.customId === 'get_email') {
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

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'email_lookup_modal') {
      const userId = interaction.fields.getTextInputValue('discord_id_input');

      const [rows] = await db.query(
        'SELECT email FROM verified_users WHERE discord_id = ?',
        [userId]
      );

      if (!rows.length)
        return interaction.reply({ content: '❌ لا يوجد إيميل مرتبط', ephemeral: true });

      return interaction.reply({
        content: `📧 الإيميل الجامعي:\n**${rows[0].email}**`,
        ephemeral: true
      });
    }

    if (interaction.isButton() && ['ban_user', 'unban_user'].includes(interaction.customId)) {
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

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ban_modal') {
      return handleBan(interaction, interaction.fields.getTextInputValue('input'));
    }

    if (interaction.isModalSubmit() && interaction.customId === 'unban_modal') {
      return handleUnban(interaction, interaction.fields.getTextInputValue('input'));
    }

  } catch (err) {
    console.error('Interaction error:', err);
  }
});

// ===================== PRIVATE VERIFY =====================
client.on('messageCreate', async message => {
  if (message.author.bot || message.guild) return;

  const userData = verificationCodes.get(message.author.id);
  if (!userData) return;

  // EMAIL STEP
  if (userData.step === 'email') {
    const email = message.content.trim();

    if (!email.endsWith('@students.ptuk.edu.ps'))
      return message.reply('❌ استخدم الإيميل الجامعي فقط');

    const [exists] = await db.query(
      'SELECT id FROM verified_users WHERE email = ?',
      [email]
    );

    if (exists.length)
      return message.reply('❌ هذا الإيميل مستخدم بالفعل');

    const code = Math.floor(100000 + Math.random() * 900000);

    verificationCodes.set(message.author.id, { step: 'code', code, email });

    // ================= EMAIL SEND =================
    try {
      await transporter.sendMail({
        from: `"PTUK Verify" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verification Code',
        html: `<h2>رمز التحقق</h2><h1>${code}</h1>`
      });

      return message.reply('📨 تم إرسال الكود — أرسله هنا');

    } catch (err) {
      console.error("❌ EMAIL SEND FAILED:", err.message);

      verificationCodes.delete(message.author.id);

      return message.reply(
        '❌ فشل إرسال الإيميل.\n' +
        'السبب غالبًا Railway تمنع Gmail SMTP.\n' +
        'تواصل مع الإدارة.'
      );
    }
  }

  // CODE STEP
  if (userData.step === 'code') {
    if (message.content.trim() !== userData.code.toString())
      return message.reply('❌ الكود خاطئ');

    const guild = await client.guilds.fetch(SERVER_ID);
    const member = await guild.members.fetch(message.author.id).catch(() => null);

    if (!member) return message.reply('❌ يجب أن تكون داخل السيرفر');

    await db.query(
      'INSERT IGNORE INTO verified_users (discord_id, email, banned) VALUES (?, ?, 0)',
      [message.author.id, userData.email]
    );

    const activationRole = guild.roles.cache.find(r => r.name === 'Activation required');
    const memberRole = guild.roles.cache.find(r => r.name === 'member');

    if (activationRole) await member.roles.remove(activationRole);
    if (memberRole) await member.roles.add(memberRole);

    verificationCodes.delete(message.author.id);

    return message.reply('🎉 تم تفعيل حسابك بنجاح — مرحبًا بك!');
  }
});

// ===================== BAN =====================
async function handleBan(interaction, input) {
  const guild = interaction.guild;
  let userId = input;

  if (input.includes('@')) {
    const [rows] = await db.query(
      'SELECT discord_id FROM verified_users WHERE email = ?',
      [input]
    );
    userId = rows[0]?.discord_id;
  }

  if (!userId)
    return interaction.reply({ content: '❌ المستخدم غير موجود', ephemeral: true });

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member)
    return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر', ephemeral: true });

  const bannedRole = guild.roles.cache.find(r => r.name === 'banned');
  if (!bannedRole)
    return interaction.reply({ content: '❌ رول banned غير موجود', ephemeral: true });

  await member.roles.set([bannedRole]);
  await db.query('UPDATE verified_users SET banned = 1 WHERE discord_id = ?', [userId]);

  try {
    await member.send(
      `🚫 **لقد تم حظرك من السيرفر** بسبب انتهاكك أحد القوانين.\n\n` +
      `🎫 لأي استفسار توجه إلى:\n` +
      `**Ticket → ticket → Create Ticket**\n\n` +
      `🕒 سيتم الرد عليك قريبًا.`
    );
  } catch {}

  return interaction.reply({ content: '🚫 تم حظر المستخدم وإرسال رسالة له', ephemeral: true });
}

// ===================== UNBAN =====================
async function handleUnban(interaction, input) {
  const guild = interaction.guild;
  let userId = input;

  if (input.includes('@')) {
    const [rows] = await db.query(
      'SELECT discord_id FROM verified_users WHERE email = ?',
      [input]
    );
    userId = rows[0]?.discord_id;
  }

  if (!userId)
    return interaction.reply({ content: '❌ المستخدم غير موجود', ephemeral: true });

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member)
    return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر', ephemeral: true });

  const memberRole = guild.roles.cache.find(r => r.name === 'member');

  await member.roles.set(memberRole ? [memberRole] : []);
  await db.query('UPDATE verified_users SET banned = 0 WHERE discord_id = ?', [userId]);

  return interaction.reply({ content: '✅ تم فك الحظر بنجاح', ephemeral: true });
}

// ===================== LOGIN =====================
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود في Variables');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
