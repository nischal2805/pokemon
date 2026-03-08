FROM node:22.14-alpine3.21
WORKDIR /app
# better-sqlite3 needs native compilation
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 3001
CMD ["node", "index.js"]
