#!/bin/bash
set -e

echo 'org.apache.tomcat.util.digester.PROPERTY_SOURCE=org.apache.tomcat.util.digester.EnvironmentPropertySource' >> /usr/local/tomcat/conf/catalina.properties
echo "RDF4J_DATA_DIR is set to: ${RDF4J_DATA_DIR}"

/usr/local/tomcat/setup_web_auth.sh

echo "showing rdf4j data directory"
ls -l /rdf4j-data

# Set default values for memory if not provided
CONTAINER_MEMORY_LIMIT=${RDF4J_CONTAINER_MEMORY_LIMIT:-6144}
HEAP_RATIO=0.75  # Use 75% of container memory for heap

# Calculate heap size in MB
HEAP_SIZE_MB=$(echo "${CONTAINER_MEMORY_LIMIT} * ${HEAP_RATIO}" | bc | cut -d. -f1)

# Convert MB to GB for Java opts
HEAP_SIZE_GB=$((HEAP_SIZE_MB / 1024))g

# Set Java options
export JAVA_OPTS="-Xms${HEAP_SIZE_GB} -Xmx${HEAP_SIZE_GB} -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+ParallelRefProcEnabled -XX:+UseStringDeduplication -Djava.protocol.handler.pkgs=org.apache.catalina.webresources -Dsun.io.useCanonCaches=false -Dorg.apache.catalina.security.SecurityListener.UMASK=0027 -Dorg.eclipse.rdf4j.appdata.basedir=/rdf4j-data"

# Use JAVA_OPTS for Catalina as well
export CATALINA_OPTS="${JAVA_OPTS}"

# Start Web Application
# Check the role and perform appropriate actions
/usr/local/tomcat/create_repository.sh &
catalina.sh start
tail -f /usr/local/tomcat/logs/catalina.out
