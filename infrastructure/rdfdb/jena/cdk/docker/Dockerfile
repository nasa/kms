FROM maven:3.8.7-openjdk-18-slim

# Install necessary tools
RUN apt-get update && apt-get install -y wget curl && rm -rf /var/lib/apt/lists/*

# Set Fuseki version dynamically
RUN FUSEKI_VERSION=$(curl -s https://downloads.apache.org/jena/binaries/ | grep -oP 'apache-jena-fuseki-\K[0-9.]+(?=\.tar\.gz)' | sort -V | tail -n 1) \
  && echo "Latest Fuseki version: ${FUSEKI_VERSION}" \
  && wget https://downloads.apache.org/jena/binaries/apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz \
  && tar -xzf apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz \
  && mv apache-jena-fuseki-${FUSEKI_VERSION} /fuseki \
  && rm apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz

# Set the data directory
ENV FUSEKI_BASE /fuseki-data

# Create the data directory
RUN mkdir -p ${FUSEKI_BASE}

# Copy scripts
COPY scripts/setup.sh /setup.sh
COPY scripts/create_repository.sh /create_repository.sh

# Set correct permissions
RUN chmod +x /setup.sh /create_repository.sh

# Expose the default Fuseki port
EXPOSE 3030

# Set the entrypoint
ENTRYPOINT ["/setup.sh"]
