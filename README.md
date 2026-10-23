# WebRTC-Crash-Course

Tutorial link: https://youtu.be/8I2axE6j204

## Cloning and starting project
1. git clone https://github.com/divanov11/WebRTC-Crash-Course
2. cd WebRTC-Crash-Course
3. Create an account on agora.io
4. Create agora apora app and copy app ID
5. Copy config.example.js to config.js and fill in APP_ID and a temp RTM token for each user (config.js is gitignored)
6. Run `docker compose up -d --build`
7. Open http://127.0.0.1:5500/?user=1 and http://127.0.0.1:5500/?user=2 in two browsers
