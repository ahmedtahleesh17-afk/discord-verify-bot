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
    GatewayIntentBits.GuildMembers
  ]
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

// ===================== STORAGE =====================
const verificationCodes = new Map();
const cooldown = new Map();

// ===================== SERVER SETTINGS =====================
const SERVER_ID = '1469423215196770468';
const VERIFY_CHANNEL_ID = '1469452854535258232';
const SELECT_CHANNEL_ID = '1470015706107084895';

// ===================== AUTO ROLE =====================
client.on('guildMemberAdd', async member => {

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

  if (activationRole) await member.roles.add(activationRole);

});

// ===================== READY =====================
client.once(Events.ClientReady, async () => {

  console.log(`✅ Bot online as ${client.user.tag}`);

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

});

// ===================== INTERACTIONS =====================
client.on(Events.InteractionCreate, async interaction => {

  try {

    // ================= VERIFY BUTTON =================
    if (interaction.isButton() && interaction.customId === 'verify_start') {

      const modal = new ModalBuilder()
        .setCustomId('verify_modal')
        .setTitle('Student Verification');

      modal.addComponents(

        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('first_name')
            .setLabel('First Name (English)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),

        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('last_name')
            .setLabel('Last Name (English)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),

        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('email')
            .setLabel('University Email')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )

      );

      return interaction.showModal(modal);
    }

    // ================= VERIFY MODAL =================
    if (interaction.isModalSubmit() && interaction.customId === 'verify_modal') {

      await interaction.deferReply({ ephemeral: true });

      const first = interaction.fields.getTextInputValue('first_name');
      const last = interaction.fields.getTextInputValue('last_name');
      const email = interaction.fields.getTextInputValue('email');

      if (!email.endsWith("@students.ptuk.edu.ps"))
        return interaction.editReply("❌ استخدم الإيميل الجامعي");

      const code = Math.floor(100000 + Math.random() * 900000);

      verificationCodes.set(interaction.user.id, {
        code,
        email,
        first,
        last,
        expires: Date.now() + 5 * 60 * 1000
      });

      await sgMail.send({
        to: email,
        from: process.env.EMAIL_USER,
        subject: "PTUK Verification Code",
        html: `<h2>Verification Code</h2><h1>${code}</h1>`
      });

      const codeModal = new ModalBuilder()
        .setCustomId("verify_code_modal")
        .setTitle("Enter Verification Code");

      codeModal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("code_input")
            .setLabel("Verification Code")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      await interaction.editReply("📨 تم إرسال الكود إلى الإيميل");

      setTimeout(() => {
        interaction.showModal(codeModal);
      }, 1000);
    }

    // ================= CODE VERIFY =================
    if (interaction.isModalSubmit() && interaction.customId === 'verify_code_modal') {

      await interaction.deferReply({ ephemeral: true });

      const codeInput = interaction.fields.getTextInputValue('code_input');
      const data = verificationCodes.get(interaction.user.id);

      if (!data) return interaction.editReply("❌ انتهت الجلسة");

      if (codeInput !== data.code.toString())
        return interaction.editReply("❌ الكود غير صحيح");

      const guild = await client.guilds.fetch(SERVER_ID);
      const member = await guild.members.fetch(interaction.user.id);

      await member.setNickname(`${data.first} ${data.last}`);

      await db.query(
        `INSERT INTO verified_users (discord_id,email,banned)
         VALUES (?, ?, 0)
         ON DUPLICATE KEY UPDATE email = VALUES(email)`,
        [interaction.user.id, data.email]
      );

      const activationRole = guild.roles.cache.find(r => r.name === "Activation required");
      const memberRole = guild.roles.cache.find(r => r.name === "member");

      if (activationRole) await member.roles.remove(activationRole);
      if (memberRole) await member.roles.add(memberRole);

      verificationCodes.delete(interaction.user.id);

      return interaction.editReply("🎉 تم التفعيل بنجاح");

    }

    // ================= GET EMAIL =================
    if (interaction.isButton() && interaction.customId === 'get_email') {

      const modal = new ModalBuilder()
        .setCustomId('email_lookup_modal')
        .setTitle('Get Student Email');

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

      await interaction.deferReply({ ephemeral: true });

      const userId = interaction.fields.getTextInputValue('discord_id_input');

      const [rows] = await db.query(
        'SELECT email FROM verified_users WHERE discord_id = ?',
        [userId]
      );

      if (!rows.length)
        return interaction.editReply('❌ لا يوجد إيميل');

      return interaction.editReply(`📧 الإيميل: ${rows[0].email}`);
    }

    // ================= BAN USER =================
    if (interaction.isButton() && interaction.customId === 'ban_user') {

      const modal = new ModalBuilder()
        .setCustomId('ban_modal')
        .setTitle('Ban User');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('input')
            .setLabel('Discord ID أو Email')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ban_modal') {
      await interaction.deferReply({ ephemeral: true });
      return handleBan(interaction, interaction.fields.getTextInputValue('input'));
    }

    // ================= UNBAN USER =================
    if (interaction.isButton() && interaction.customId === 'unban_user') {

      const modal = new ModalBuilder()
        .setCustomId('unban_modal')
        .setTitle('Unban User');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('input')
            .setLabel('Discord ID أو Email')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'unban_modal') {
      await interaction.deferReply({ ephemeral: true });
      return handleUnban(interaction, interaction.fields.getTextInputValue('input'));
    }

  } catch (err) {
    console.error("Interaction Error:", err);
  }

});

// ===================== BAN FUNCTION =====================
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

  const member = await guild.members.fetch(userId).catch(()=>null);

  const bannedRole = guild.roles.cache.find(r => r.name === 'banned');

  await member.roles.set([bannedRole]);

  await db.query(
    'UPDATE verified_users SET banned = 1 WHERE discord_id = ?',
    [userId]
  );

  return interaction.editReply('🚫 تم حظر المستخدم');
}

// ===================== UNBAN FUNCTION =====================
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

  const member = await guild.members.fetch(userId);

  const bannedRole = guild.roles.cache.find(r => r.name === 'banned');
  const memberRole = guild.roles.cache.find(r => r.name === 'member');

  if (bannedRole) await member.roles.remove(bannedRole);
  if (memberRole) await member.roles.add(memberRole);

  await db.query(
    'UPDATE verified_users SET banned = 0 WHERE discord_id = ?',
    [userId]
  );

  return interaction.editReply('✅ تم فك الحظر');
}

// ===================== LOGIN =====================
client.login(process.env.DISCORD_TOKEN);
