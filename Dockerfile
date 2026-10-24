FROM nginx:1.27-alpine

# Make a self-signed certificate so other machines can use the camera over HTTPS
RUN apk add --no-cache openssl \
    && mkdir -p /etc/nginx/certs \
    && openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
        -keyout /etc/nginx/certs/key.pem -out /etc/nginx/certs/cert.pem \
        -subj "/CN=webrtc-local"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html main.css config.js main.js agora-rtm-sdk-1.4.4.js /usr/share/nginx/html/

EXPOSE 80 443
