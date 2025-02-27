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
    curl -u ${RDF4J_USER_NAME}:${RDF4J_PASSWORD} -X PUT -H "Content-Type: application/x-turtle" --data-binary '
#
# RDF4J configuration template for a main-memory repository
#
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix config: <tag:rdf4j.org,2023:config/>.

[] a config:Repository ;
   config:rep.id "kms" ;
   rdfs:label "kms" ;
   config:rep.impl [
      config:rep.type "openrdf:SailRepository" ;
      config:sail.impl [
        config:sail.type "openrdf:NativeStore" ;
        config:native.forceSync true ;
        config:sail.memory "false" ;
        config:sail.reindex "true" ;
        config:sail.writeThrough "true" ;
    ]
   ].
    ' http://localhost:8080/rdf4j-server/repositories/kms
    echo "Repository created successfully"
  else
    echo "Repository 'kms' already exists. Skipping creation."
  fi
}

# Call the function
create_repository