require('dotenv').config();
const PubNub = require('pubnub');
const tmi = require('tmi.js');
const Gtts = require('gtts');
const fs = require('fs').promises;
const ffmpeg = require('fluent-ffmpeg');
const crypto = require('crypto');

const pubnub = new PubNub({
    publishKey: process.env.PUBNUB_PUBLISH_KEY,
    subscribeKey: process.env.PUBNUB_SUBSCRIBE_KEY,
    uuid: 'backend'
});

pubnub.subscribe({ channels: ['twitch-channel-requests'] });
console.log("waiting for twitch channel....");

pubnub.addListener({
    message: async (msg) => {
        const channelName = msg.message.channel;
        const twitchClient = new tmi.Client({ channels: [channelName] });
        console.log(`Received request for channel ${channelName}....`);

        await twitchClient.connect();

        twitchClient.on('message', async (channel, tags, message, self) => {
            if (self) return;

            const userMessage = `${tags['display-name']}: ${message}`;
            console.log(userMessage);
            const gtts = new Gtts(message, 'en');
            const filePath = `./${Date.now()}.mp3`;
            const compressedFilePath = `./${Date.now()}_compressed.mp3`;
            
            // Generate TTS audio
            await new Promise((resolve, reject) => gtts.save(filePath, err => (err ? reject(err) : resolve())));

            // Compress the audio with ffmpeg
            await new Promise((resolve, reject) => {
                ffmpeg(filePath)
                    .audioBitrate('32k')
                    .audioFrequency(22050)
                    .save(compressedFilePath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            // Read the compressed file and encode to Base64
            const audioData = await fs.readFile(compressedFilePath, { encoding: 'base64' });
            const chunkSize = 16000;  // Size of each chunk (adjust as needed)
            const totalChunks = Math.ceil(audioData.length / chunkSize);
            const messageId = crypto.randomUUID(); // Unique ID for this message

            // Split and send chunks
            for (let i = 0; i < totalChunks; i++) {
                const chunk = audioData.slice(i * chunkSize, (i + 1) * chunkSize);
                
                await pubnub.publish({
                    channel: channelName,
                    message: JSON.stringify({
                        messageId,
                        chunkIndex: i,
                        totalChunks,
                        text: message, // Optional: send text in each chunk if needed
                        audioChunk: chunk,
                        name: tags['display-name']
                    })
                });
            }

            // Clean up temporary files
            await fs.unlink(filePath);
            await fs.unlink(compressedFilePath);
        });
    }
});
