FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production=false
COPY tsconfig.json ./
COPY src/ src/
RUN npx tsc
RUN npm prune --production
COPY public/ public/
EXPOSE 3099
CMD ["node", "dist/server.js"]
