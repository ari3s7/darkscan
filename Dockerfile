FROM mcr.microsoft.com/playwright:v1.63.0-jammy

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/rules/package.json packages/rules/package.json

RUN npm ci

COPY . .

# Generate only. The real database URL is injected when the container starts.
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/darkscan?schema=public"
RUN npm run build -w @darkscan/server

CMD ["sh", "-c", "npm run db:migrate && node apps/server/dist/index.js"]
