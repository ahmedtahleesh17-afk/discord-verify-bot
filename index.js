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
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: ['CHANNEL']
});

// ===================== DATABASE ===================
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

    // إذا محظور
    if (rows.length && rows[0].banned == 1) {
      if (bannedRole) await member.roles.add(bannedRole);
      return;
    }

    // إذا مفعل سابقًا
    if (rows.length && rows[0].banned == 0) {
      if (memberRole) await member.roles.add(memberRole);
      return;
    }

    // عضو جديد → نعطيه Activation فقط بدون حذف باقي الرولات
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

// ===================== INTERACTIONS =====================
// ===================== INTERACTIONS =====================
client.on(Events.InteractionCreate, async interaction => {
  try {

    // VERIFY BUTTON
    if (interaction.isButton() && interaction.customId === 'verify_start') {
      if (!interaction.deferred && !interaction.replied)
        await interaction.deferReply({ flags: 64 });

      try {
      // أول رسالة: الفيديو فقط
await interaction.user.send(
`📹 **شاهد الفيديو التعريفي لطريقة تفعيل حسابك في السيرفر:**
https://www.youtube.com/shorts/MsUS0BXnjjE`
);

// ثاني رسالة: طلب الإيميل
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

    // GET EMAIL MODAL
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

    // EMAIL LOOKUP
    if (interaction.isModalSubmit() && interaction.customId === 'email_lookup_modal') {

      if (!interaction.deferred && !interaction.replied)
        await interaction.deferReply({ flags: 64 });

      const userId = interaction.fields.getTextInputValue('discord_id_input');

      const [rows] = await db.query(
        'SELECT email FROM verified_users WHERE discord_id = ?',
        [userId]
      );

      if (!rows.length)
        return interaction.editReply('❌ لا يوجد إيميل مرتبط');

      return interaction.editReply(`📧 الإيميل الجامعي:\n**${rows[0].email}**`);
    }

    // BAN / UNBAN BUTTONS
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

    if (interaction.isModalSubmit() && interaction.customId === 'ban_modal') {

      if (!interaction.deferred && !interaction.replied)
        await interaction.deferReply({ flags: 64 });

      return handleBan(interaction, interaction.fields.getTextInputValue('input'));
    }

    if (interaction.isModalSubmit() && interaction.customId === 'unban_modal') {

      if (!interaction.deferred && !interaction.replied)
        await interaction.deferReply({ flags: 64 });

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
      'SELECT discord_id FROM verified_users WHERE email = ?',
      [email]
    );

    if (exists.length)
      return message.reply('❌ هذا الإيميل مستخدم بالفعل');

    const code = Math.floor(100000 + Math.random() * 900000);

    verificationCodes.set(message.author.id, { step: 'code', code, email });

    try {
      await sgMail.send({
        to: email,
        from: process.env.EMAIL_USER,
        subject: 'PTUK Verification Code',
        html: `<h2>رمز التحقق</h2><h1>${code}</h1>`
      });
return message.reply('📨 تم إرسال كود التحقق إلى بريدك الجامعي\n\n**ملاحظة: يرجى التحقق من قسم البريد غير الهام (Junk/Spam) فقد تجد الرمز هناك.**');



    } catch {
      verificationCodes.delete(message.author.id);
      return message.reply('❌ فشل إرسال الإيميل — أبلغ الإدارة.');
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
      `INSERT INTO verified_users (discord_id, email, banned)
       VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE email = VALUES(email)` ,
      [message.author.id, userData.email]
    );

    const activationRole = guild.roles.cache.find(r => r.name === 'Activation required');
    const memberRole = guild.roles.cache.find(r => r.name === 'member');

    // إزالة رول التفعيل فقط
    if (activationRole && member.roles.cache.has(activationRole.id)) {
      await member.roles.remove(activationRole);
    }

    // إضافة رول العضو بدون حذف باقي الرولات
    if (memberRole && !member.roles.cache.has(memberRole.id)) {
      await member.roles.add(memberRole);
    }

    verificationCodes.delete(message.author.id);

    return message.reply('🎉 تم تفعيل حسابك بنجاح — مرحبًا بك!\nhttps://discord.gg/VF3Kr2Rbta');
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
    return interaction.editReply('❌ المستخدم غير موجود');

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member)
    return interaction.editReply('❌ العضو غير موجود بالسيرفر');

  const bannedRole = guild.roles.cache.find(r => r.name === 'banned');
  if (!bannedRole)
    return interaction.editReply('❌ رول banned غير موجود');

  await member.roles.set([bannedRole]);
  await db.query('UPDATE verified_users SET banned = 1 WHERE discord_id = ?', [userId]);

  try { await member.send('🚫 لقد تم حظرك من السيرفر بسبب مخالفة القوانين.'); } catch {}

  return interaction.editReply('🚫 تم حظر المستخدم');
}

// ===================== UNBAN =====================
async function handleUnban(interaction, input) {
  const guild = interaction.guild;
  let userId = input;

  // إذا الإدخال كان إيميل → نجيب Discord ID
  if (input.includes('@')) {
    const [rows] = await db.query(
      'SELECT discord_id FROM verified_users WHERE email = ?',
      [input]
    );
    userId = rows[0]?.discord_id;
  }

  if (!userId)
    return interaction.editReply('❌ المستخدم غير موجود');

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member)
    return interaction.editReply('❌ العضو غير موجود بالسيرفر');

  const bannedRole = guild.roles.cache.find(r => r.name === 'banned');
  const memberRole = guild.roles.cache.find(r => r.name === 'member');

  // إزالة رول الحظر
  if (bannedRole && member.roles.cache.has(bannedRole.id)) {
    await member.roles.remove(bannedRole);
  }

  // إضافة رول العضو بدون حذف باقي الرولات
  if (memberRole && !member.roles.cache.has(memberRole.id)) {
    await member.roles.add(memberRole);
  }

  // تحديث قاعدة البيانات
  await db.query('UPDATE verified_users SET banned = 0 WHERE discord_id = ?', [userId]);

  // إرسال رسالة للعضو (اختياري)
  try {
    await member.send('✅ تم فك الحظر عنك ويمكنك استخدام السيرفر مجددًا');
  } catch {}

  return interaction.editReply('✅ تم فك الحظر وإزالة رول banned');
}

// ===================== LOGIN =====================
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);











