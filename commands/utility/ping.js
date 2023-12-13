const { SlashCommandBuilder } = require('discord.js');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Ping le Gyro et attend un ACK'),
	async execute(interaction) {
		await interaction.reply('Pong!');
	},
};