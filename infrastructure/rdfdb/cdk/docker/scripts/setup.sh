#!/bin/bash
set -e

echo 'org.apache.tomcat.util.digester.PROPERTY_SOURCE=org.apache.tomcat.util.digester.EnvironmentPropertySource' >> /usr/local/tomcat/conf/catalina.properties
echo "RDF4J_DATA_DIR is set to: ${RDF4J_DATA_DIR}"

/usr/local/tomcat/setup_web_auth.sh

echo "showing rdf4j data directory"
ls -l /rdf4j-data

# Set Java options
export JAVA_OPTS="-Xms8g -Xmx8g -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+ParallelRefProcEnabled -XX:+UseStringDeduplication -Djava.protocol.handler.pkgs=org.apache.catalina.webresources -Dsun.io.useCanonCaches=false -Dorg.apache.catalina.security.SecurityListener.UMASK=0027 -Dorg.eclipse.rdf4j.appdata.basedir=/rdf4j-data"

# Use JAVA_OPTS for Catalina as well
export CATALINA_OPTS="${JAVA_OPTS}"

# Start Web Application
# Check the role and perform appropriate actions
/usr/local/tomcat/create_repository.sh &
catalina.sh start
tail -f /usr/local/tomcat/logs/catalina.out
