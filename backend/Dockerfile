# ─────────────────────────────────────────────
#  KariGo Backend — Production Docker Image
# ─────────────────────────────────────────────
FROM node:20-alpine

# Install dumb-init for proper signal handling (PID 1)
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy manifests first (layer cache: only re-install when deps change)
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/
COPY scripts/ ./scripts/

# Runtime directory (bookings / state files written here)
RUN mkdir -p ./runtime && chown -R node:node ./runtime

# Expose the port the app listens on
ENV PORT=3001
EXPOSE 3001

# Run as non-root user for security
USER node

# Use dumb-init so signals (SIGTERM) are forwarded properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
