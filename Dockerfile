FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Create data directories
RUN mkdir -p output/raw output/clean output/events output/probability output/lenses

# Expose ports
EXPOSE 3000 3001

# Run
CMD ["node", "l4/api_server.js"]
