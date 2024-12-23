FROM node:22.12.0-bullseye-slim

RUN npm install -g pnpm

WORKDIR /var/www

COPY . .

RUN pnpm install

EXPOSE 5000

CMD ["pnpm", "start"]