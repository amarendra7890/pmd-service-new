# Use a base image that has both Node.js and Java
FROM eclipse-temurin:17-jdk

# Install Node.js 20
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node --version && npm --version && java -version

# Install Salesforce CLI and both scanners
RUN npm install -g @salesforce/cli && \
    sf plugins install @salesforce/sfdx-scanner && \
    sf plugins install code-analyzer

# Verify both installations
# Note: This might fail during build if sf tries to update itself, but usually safe
# RUN sf scanner --help 

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --only=production

# Copy application code
COPY index.js .

# Create temp directory for PMD files
RUN mkdir -p /tmp

# Expose port
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]
