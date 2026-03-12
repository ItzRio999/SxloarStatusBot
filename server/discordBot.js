import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { STATUS_OPTIONS, readTicketStatus, writeTicketStatus } from './ticketStatusStore.js';

const commandName = 'ticketstatus';
const menuCustomId = 'ticket-status-select';
const toneColors = {
  active: 0x57f287,
  away: 0xfee75c,
  busy: 0xed4245,
};

function buildStatusMenu(selectedKey) {
  return new StringSelectMenuBuilder()
    .setCustomId(menuCustomId)
    .setPlaceholder('Select your ticket status')
    .addOptions(
      STATUS_OPTIONS.map((option) => ({
        label: option.label,
        description: option.description,
        value: option.key,
        emoji: option.emoji,
        default: option.key === selectedKey,
      }))
    );
}

function getUnixTimestamp(isoString) {
  return Math.floor(new Date(isoString).getTime() / 1000);
}

function buildStatusEmbed(status, userTag, siteUrl) {
  const updatedAt = getUnixTimestamp(status.updatedAt);
  const embed = new EmbedBuilder()
    .setColor(toneColors[status.tone] || 0x5865f2)
    .setTitle(`${status.emoji} Ticket Status Control`)
    .setDescription(
      [
        'Use the dropdown below to update the **ticket status pill** shown on your website.',
        '',
        `Current status: __**${status.pillText}**__`,
        `Description: *${status.description}*`,
      ].join('\n')
    )
    .addFields(
      {
        name: 'Selected Value',
        value: `\`${status.key}\``,
        inline: true,
      },
      {
        name: 'Last Updated',
        value: updatedAt > 0 ? `<t:${updatedAt}:F>\n<t:${updatedAt}:R>` : '*Not updated yet*',
        inline: true,
      },
      {
        name: 'Website Pill Text',
        value: `Copy this exact label: \`${status.pillText}\``,
        inline: false,
      }
    )
    .setFooter({
      text: `Requested by ${userTag}`,
    })
    .setTimestamp(new Date(status.updatedAt || Date.now()));

  if (siteUrl) {
    embed.addFields({
      name: 'Preview',
      value: `[Open website](${siteUrl}) to confirm the live pill.`,
      inline: false,
    });
  }

  return embed;
}

function buildComponents(selectedKey, siteUrl) {
  const rows = [new ActionRowBuilder().addComponents(buildStatusMenu(selectedKey))];

  if (siteUrl) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(siteUrl).setLabel('Open Website')
      )
    );
  }

  return rows;
}

async function registerCommands(token, applicationId, guildId) {
  const command = new SlashCommandBuilder()
    .setName(commandName)
    .setDescription('Set the ticket status pill shown on the website.');

  const rest = new REST({ version: '10' }).setToken(token);
  const body = [command.toJSON()];

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body });
    return;
  }

  await rest.put(Routes.applicationCommands(applicationId), { body });
}

function isAllowedUser(interaction, ownerUserId) {
  return !ownerUserId || interaction.user.id === ownerUserId;
}

async function safeErrorReply(interaction, message) {
  const payload = {
    embeds: [
      new EmbedBuilder().setColor(0xed4245).setTitle('Error').setDescription(message).setTimestamp(),
    ],
    flags: MessageFlags.Ephemeral,
  };

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload).catch(() => {});
    return;
  }

  await interaction.reply(payload).catch(() => {});
}

export async function startDiscordBot({
  token,
  applicationId,
  guildId,
  ownerUserId,
  onStatusChange,
  siteUrl,
  logger = console,
}) {
  if (!token || !applicationId) {
    logger.warn('Discord bot disabled. Set DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID to enable it.');
    return null;
  }

  await registerCommands(token, applicationId, guildId);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, (readyClient) => {
    logger.log(`Discord bot ready as ${readyClient.user.tag}`);
  });

  client.on('error', (error) => {
    logger.error('Discord client error:', error);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === commandName) {
        if (!isAllowedUser(interaction, ownerUserId)) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('Access Denied')
                .setDescription('This command is restricted to the configured profile owner.')
                .setTimestamp(),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral,
        });

        const currentStatus = await readTicketStatus();

        await interaction.editReply({
          embeds: [buildStatusEmbed(currentStatus, interaction.user.tag, siteUrl)],
          components: buildComponents(currentStatus.key, siteUrl),
        });
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === menuCustomId) {
        if (!isAllowedUser(interaction, ownerUserId)) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('Access Denied')
                .setDescription('You cannot change this profile status.')
                .setTimestamp(),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferUpdate();

        const selectedKey = interaction.values[0];
        const nextStatus = await writeTicketStatus(selectedKey);
        onStatusChange?.(nextStatus);

        await interaction.editReply({
          embeds: [
            buildStatusEmbed(nextStatus, interaction.user.tag, siteUrl).setAuthor({
              name: 'Status Updated Successfully',
            }),
          ],
          components: buildComponents(nextStatus.key, siteUrl),
        });
      }
    } catch (error) {
      logger.error('Interaction handler failed:', error);
      await safeErrorReply(interaction, 'The command could not be completed. Try again.');
    }
  });

  await client.login(token);
  return client;
}
