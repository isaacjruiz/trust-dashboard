FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.16.1

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Copy dataset for auto-loading
COPY "../Untitled spreadsheet - Sheet1.csv" ./dataset.csv 2>/dev/null || true

# Build
RUN pnpm run build

EXPOSE 4111

CMD ["pnpm", "run", "start"]
