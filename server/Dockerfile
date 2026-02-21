FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npx prisma generate

# Entrypoint: push schema to DB then start server
COPY <<'EOF' /app/start.sh
#!/bin/sh
set -e
echo "Pushing Prisma schema to database..."
npx prisma db push --skip-generate
echo "Starting server..."
node index.js
EOF
RUN chmod +x /app/start.sh

EXPOSE 3001
CMD ["/app/start.sh"]
