#!/bin/bash
set -e

echo 'org.apache.tomcat.util.digester.PROPERTY_SOURCE=org.apache.tomcat.util.digester.EnvironmentPropertySource' >> /usr/local/tomcat/conf/catalina.properties
echo "RDF4J_DATA_DIR is set to: ${RDF4J_DATA_DIR}"

# /usr/local/tomcat/setup_web_auth.sh

echo "showing rdf4j data directory"
ls -l /rdf4j-data

# Set Java options
JAVA_OPTS="-Dorg.eclipse.rdf4j.appdata.basedir=${RDF4J_DATA_DIR} -Xmx3g -Xms1g -XX:MaxMetaspaceSize=512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
export JAVA_OPTS

# Use JAVA_OPTS for Catalina as well
export CATALINA_OPTS="${JAVA_OPTS}"

# Start Web Application
# Check the role and perform appropriate actions
/usr/local/tomcat/create_repository.sh &
catalina.sh run
