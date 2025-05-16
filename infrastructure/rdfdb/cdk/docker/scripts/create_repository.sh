#!/bin/bash

# Function to create repository
create_repository() {
  # Wait for RDF4J server to be up
  until curl --output /dev/null --silent --fail http://localhost:8080/rdf4j-server/protocol; do
    echo "Waiting for RDF4J server to be ready..."
    sleep 5
  done

  if [ ! -d "${RDF4J_DATA_DIR}/server/repositories/kms" ]; then
    # Create the repository
    echo "Repository 'kms' does not exist. Creating it... Using ${RDF4J_USER_NAME}:${RDF4J_PASSWORD}"
    
    # Use config.ttl file
    curl -u ${RDF4J_USER_NAME}:${RDF4J_PASSWORD} \
         -X PUT \
         -H "Content-Type: text/turtle" \
         --data-binary @/usr/local/tomcat/config.ttl \
         http://localhost:8080/rdf4j-server/repositories/kms

    if [ $? -eq 0 ]; then
      echo "Repository created successfully"
    else
      echo "Failed to create repository"
      exit 1
    fi
  else
    echo "Repository 'kms' already exists. Skipping creation."
  fi
}

# Call the function
create_repository
