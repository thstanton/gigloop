FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev

COPY . .
RUN npx prisma generate && npm run build && test -f dist/main.js

EXPOSE 3000

CMD ["node", "dist/main"]
