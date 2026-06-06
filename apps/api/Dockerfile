FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
# bust cache: force fresh install so build layer always re-runs
RUN npm install --include=dev --prefer-offline=false

COPY . .
RUN npx prisma generate && npm run build && test -f dist/main.js

EXPOSE 3000

CMD ["node", "dist/main"]
