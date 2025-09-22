FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
RUN npm install
COPY server.ts ./
EXPOSE 8080
CMD ["npm", "start"]
