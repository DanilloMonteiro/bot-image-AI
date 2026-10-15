FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json next-env.d.ts ./
COPY src ./src
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
