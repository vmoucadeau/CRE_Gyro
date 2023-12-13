const dotenv = require('dotenv');
dotenv.config();
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  exitOnError: false,
  format: format.combine(
	format.timestamp({format:'DD-MM-YYYY HH:mm:ss'}),
	format.json()
  ),
  transports: [
	new transports.Console({
		format: format.combine(
			format.timestamp({format:'DD-MM-YYYY HH:mm:ss'}),
			format.splat(),
			format.colorize(),
			format.printf(({level, message, label, timestamp}) => `${timestamp} [GIROBOT] ${level}: ${message}`),
		)
	}),
    new transports.File({ filename: `./logs/combined.log` }),
	new transports.File({ filename: `./logs/errors.log`, level: 'error' })
  ],
});

const fs = require('fs');
const path = require('path');

const mqtt = require('mqtt');
var mqtt_options = {
	host: process.env.MQTT_HOST,
    port: process.env.MQTT_PORT,
    clientId: 'girobot_discord',
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASSWORD,
    keepalive: 60,
    reconnectPeriod: 1000,
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    encoding: 'utf8',
	debug: true
};

const mqttclient = mqtt.connect(mqtt_options);

const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const discordclient = new Client({ intents: [GatewayIntentBits.Guilds] });

var last_alive;
var ping_send;
var last_ping;
var last_interaction;

var giro_config = {
	"replies" : []
};

/* SETTINGS DATA FORMAT
giro_settings = {
    bot_channelid = "15648155346845",
	replies = ["Answer 1", "Answer 2"]
	["J'allume le gyro", "La lumière fut.", "Oh ça toooouuuurne :zany_face:", "Ok Google, allume le gyro", "Avec ou sans sucre le café ?", "Lumos :mage:", "C'est parti pour la disco", "Ça fera un Ricard", "Chapô :person_gesturing_ok: C'est pas moi qui descends", "Ok boomer", "Ça se dit ingé mais ça connait pas la politesse", "Wesh dit stp la prochaine fois", "Aïe j'espère pour toi que quelqu'un va vouloir venir t'ouvrir ...", "À vos ordres mon capitaine !", "Tu t'es cru sur un tracteur ou quoi à m'allumer comme ça ?", "Toi tu manques pas de toupet", "\"Hey Alexa, allume le gyro\"", "\"Dis Siri, allume le gyro\""],
}


*/

if(!fs.existsSync("data/")) {
    fs.mkdirSync("data");
}

if(fs.existsSync("data/giro_config.json")) {
	logger.info("Reading config file");
    giro_settings = JSON.parse(fs.readFileSync('data/giro_config.json', 'utf8'));
}
else {
    logger.info("Creating config file");
    fs.writeFileSync("data/giro_config.json", JSON.stringify(giro_config, null, 4));
}

function save_config() {
    logger.info("Saving config file")
    fs.writeFileSync("data/giro_config.json", JSON.stringify(giro_config, null, 4));
}

// Retreiving slash commands

discordclient.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command) {
			discordclient.commands.set(command.data.name, command);
		} else {
			logger.info(`WARNING - The command at ${filePath} is missing a required "data" property.`);
		}
	}
}

mqttclient.on('connect', () => {
	logger.info("MQTT Connect")
    mqttclient.subscribe(process.env.MQTT_GIROTOPICUP);
});

mqttclient.on('error', (error) => {
	logger.info("MQTT ERROR");
	logger.error(error.errors);
})

mqttclient.on('message', (topic, message) => {
    if(message == "Alive") {
		last_alive = new Date();
		logger.info("Gyro MQTT Alive received");
	}
	if(message == "ACK ping") {
		last_ping = new Date();
		logger.info("Gyro MQTT Ping received");
		if(last_interaction != null) {
			var pingtime = last_ping.getTime() - ping_send.getTime();
			last_interaction.editReply("Pong! (" + pingtime + "ms)");
			last_interaction = null;
		}
	}
	if(message == "ACK on") {
		logger.info("Gyro MQTT ON received");
		if(last_interaction != null) {
			last_interaction.editReply(giro_settings.replies[Math.floor(Math.random() * giro_settings.replies.length)]);
			last_interaction = null;
		}
	}

});

discordclient.once(Events.ClientReady, readyClient => {
	logger.info(`Ready! logged in as ${readyClient.user.tag}`);
});

discordclient.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	if(interaction.commandName == "gyro") {
		logger.info(interaction.user.username + " used the command gyro");
		await interaction.deferReply();
		ping_send = new Date();
		mqttclient.publish(process.env.MQTT_GIROTOPICDOWN, "ON");
		last_interaction = interaction;
		await (new Promise(resolve => setTimeout(resolve, 5000)));
		if(last_interaction != null) {
			last_interaction.editReply("Je ne suis pas connecté :sob: <@&" + process.env.DISCORD_ROLEID + ">");
			last_interaction = null;
		}
	}

	if(interaction.commandName == "ping") {
		logger.info(interaction.user.username + " used the command ping");
		await interaction.deferReply({ephemeral: true});
		ping_send = new Date();
		mqttclient.publish(process.env.MQTT_GIROTOPICDOWN, "PING");
		last_interaction = interaction;
		await (new Promise(resolve => setTimeout(resolve, 5000)));
		if(last_interaction != null) {
			last_interaction.editReply("Je ne suis pas connecté :sob: <@&" + process.env.DISCORD_ROLEID + ">");
			last_interaction = null;
		}
	}

});


discordclient.login(process.env.DISCORD_TOKEN);