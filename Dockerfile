FROM node:22-alpine

WORKDIR /app

# Copy backend package files
COPY backend-scaffold/backend/node-api/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY backend-scaffold/backend/node-api/src ./src

# Expose port
EXPOSE 4000

# Start the application
CMD ["npm", "start"]
