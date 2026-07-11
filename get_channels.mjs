import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const apiId = 35691342;
const apiHash = "84d8f1a2c0e9c4c09cff23316db186ec";
const stringSession = new StringSession("");

const botToken = "778532517:AAGfLWpYw9-IIEhxs9b-7EL5Of7d3mXfKVk";

(async () => {
    console.log("Loading interactive example...");
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });
    
    await client.start({
        botAuthToken: botToken,
    });
    
    console.log("You should now be connected.");
    console.log(client.session.save());

    const dialogs = await client.getDialogs({});
    console.log("Dialogs:", dialogs.map(d => ({ title: d.title, id: d.id.toString(), isChannel: d.isChannel })));
})();
