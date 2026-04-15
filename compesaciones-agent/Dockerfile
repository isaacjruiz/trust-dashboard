FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.16.1

# Install dependencies first (better layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source (node_modules excluded via .dockerignore)
COPY . .

# Build
RUN pnpm run build

# Runtime env vars — pass these at deploy time, never bake secrets into the image
# Required:
#   ANTHROPIC_API_KEY   — Claude Sonnet (trust agent chat)
#   OPENAI_API_KEY      — GPT-4o-mini  (ESCALAR batch analysis)
# Optional:
#   PORT                — defaults to 4111

EXPOSE 4111

CMD ["pnpm", "run", "start"]
