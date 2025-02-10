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
    echo "Repository 'kms' does not exist. Creating it..."
    curl -u rdf4j:rdf4j -X PUT -H "Content-Type: application/x-turtle" --data-binary '
@prefix config: <tag:rdf4j.org,2023:config/> .
@prefix ns: <http://rdf4j.org/config/sail/lmdb#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

[] a config:Repository;
  rdfs:label "kms";
  config:rep.id "kms";
  config:rep.impl [
    config:rep.type "openrdf:SailRepository";
    config:sail.impl [
      config:sail.type "rdf4j:LmdbStore";
      ns:readOnly "false";
      ns:autoGrow "true";
      ns:transactionBufferSize "1048576";
      ns:forceSync "true"
    ]
  ] .
    ' http://localhost:8080/rdf4j-server/repositories/kms
    echo "Repository created successfully"
  else
    echo "Repository 'kms' already exists. Skipping creation."
  fi
}

# Call the function
create_repository