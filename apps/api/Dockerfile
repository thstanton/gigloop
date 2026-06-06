FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev

COPY . .

WORKDIR /app/apps/api
RUN npx prisma generate && npm run build

EXPOSE 3000

CMD ["node", "dist/main"]
