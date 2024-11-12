require('dotenv').config();
const PubNub = require('pubnub');
const tmi = require('tmi.js');
const Gtts = require('gtts');
const fs = require('fs').promises;

// Initialize PubNub
const pubnub = new PubNub({
    publishKey: process.env.PUBNUB_PUBLISH_KEY,
    subscribeKey: process.env.PUBNUB_SUBSCRIBE_KEY,
    uuid: 'backend'
});

// Listen for channel name messages
pubnub.subscribe({ channels: ['twitch-channel-requests'] });

console.log(`Waiting for client to request messages...`);


pubnub.addListener({
    message: async (msg) => {
        const channelName = msg.message.channel;
        console.log(`Received request to connect to Twitch channel: ${channelName}`);

        // Set up Twitch client
        const twitchClient = new tmi.Client({
            channels: [channelName]
        });

        await twitchClient.connect();

        // Listen for Twitch chat messages
        twitchClient.on('message', async (channel, tags, message, self) => {
            if (self) return;

            const userMessage = `${tags['display-name']} says ${message}`;
            console.log(`Received Twitch message: ${userMessage}`);

            // Publish audio message back to the PubNub channel for this Twitch channel
            pubnub.publish({
                channel: channelName,
                message: {
                    text: userMessage,
                    //audio: audioData
                }
            });

            /*
            try {
                // Generate TTS audio file using gTTS
                const gtts = new Gtts(userMessage, 'en');
                const filePath = `./${Date.now()}.mp3`;
                await new Promise((resolve, reject) => {
                    gtts.save(filePath, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                // Read and encode the audio file in Base64
                const audioData = await fs.readFile(filePath, { encoding: 'base64' });
                await fs.unlink(filePath); // Clean up the file after encoding

                // Publish audio message back to the PubNub channel for this Twitch channel
                pubnub.publish({
                    channel: channelName,
                    message: {
                        text: userMessage,
                        audio: audioData
                    }
                });
            } catch (error) {
                console.error('Error processing Twitch message:', error);
            }
            */
        });
    }

});
