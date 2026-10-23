FROM nginx:1.27-alpine

COPY index.html main.css config.js main.js agora-rtm-sdk-1.4.4.js /usr/share/nginx/html/

EXPOSE 80
