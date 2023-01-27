FROM node:16.18-buster
COPY . /app
WORKDIR /app
RUN npm install
RUN npm install -g pm2
CMD ["pm2-runtime", "index.js"]
