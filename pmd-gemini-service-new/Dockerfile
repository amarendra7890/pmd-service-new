# Use a base image that has a robust Java environment (PMD needs Java)
FROM eclipse-temurin:17-jdk

# Install Node.js 20 and necessary utilities (wget, unzip)
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    wget \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------
# PERFORMANCE OPTIMIZATION: Install PMD Native Binary
# We install PMD 7.11.0 directly to avoid the 'sf scanner' spin-up lag.
# ---------------------------------------------------------------------
RUN wget https://github.com/pmd/pmd/releases/download/pmd_releases/7.11.0/pmd-dist-7.11.0-bin.zip \
    && unzip pmd-dist-7.11.0-bin.zip \
    && mv pmd-bin-7.11.0 /opt/pmd \
    && chmod +x /opt/pmd/bin/pmd \
    && rm pmd-dist-7.11.0-bin.zip

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --only=production

# Copy application code
COPY index.js .

# Create temp directory for file processing
RUN mkdir -p /tmp

# Expose port
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]