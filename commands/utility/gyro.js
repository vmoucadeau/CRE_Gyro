const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('gyro')
		.setDescription('Allume le gyro')
};