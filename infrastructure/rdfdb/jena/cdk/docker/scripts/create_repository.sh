#!/bin/bash

# Function to create dataset and load inline TTL configuration
create_repository() {
  # Wait for Fuseki server to be up
  until curl -u admin:${ADMIN_PASSWORD} \
    --output /dev/null --silent --fail http://localhost:3030/$/ping; do
    echo "Waiting for Fuseki server to be ready..."
    sleep 5
  done

  # Check if the dataset exists
  if ! curl --output /dev/null --silent --fail http://localhost:3030/kms; then
    # Create the dataset
    echo "Dataset 'kms' does not exist. Creating it..."
    curl -X POST \
         -H "Content-Type: application/x-www-form-urlencoded" \
         -d "dbType=tdb2&dbName=kms" \
         -u admin:${ADMIN_PASSWORD} \
         http://localhost:3030/$/datasets

    if [ $? -eq 0 ]; then
      echo "Dataset created successfully"
      
      # Load inline TTL configuration
      echo "Loading inline TTL configuration"
      curl -X POST \
           -H "Content-Type: text/turtle" \
           --data-binary @- \
           -u admin:${ADMIN_PASSWORD} \
           http://localhost:3030/kms/data <<EOL
@prefix : <#> .
@prefix fuseki: <http://jena.apache.org/fuseki#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix tdb2: <http://jena.apache.org/2016/tdb#> .
@prefix ja: <http://jena.hpl.hp.com/2005/11/Assembler#> .

[] rdf:type fuseki:Server .

:service_tdb_all rdf:type fuseki:Service ;
    rdfs:label "TDB2 kms" ;
    fuseki:name "kms" ;
    fuseki:serviceQuery "query" , "sparql" ;
    fuseki:serviceUpdate "update" ;
    fuseki:serviceUpload "upload" ;
    fuseki:serviceReadWriteGraphStore "data" ;
    fuseki:serviceReadGraphStore "get" ;
    fuseki:dataset :tdb_dataset_readwrite ;
    .

:tdb_dataset_readwrite rdf:type tdb2:DatasetTDB2 ;
    tdb2:location "${FUSEKI_BASE}/databases/kms" ;
    .
EOL

      if [ $? -eq 0 ]; then
        echo "TTL configuration loaded successfully"
      else
        echo "Failed to load TTL configuration"
        exit 1
      fi
    else
      echo "Failed to create dataset"
      exit 1
    fi
  else
    echo "Dataset 'kms' already exists. Skipping creation."
  fi
}

# Call the function
create_repository
