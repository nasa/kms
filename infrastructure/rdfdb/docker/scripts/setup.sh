#!/bin/bash
set -e

echo 'org.apache.tomcat.util.digester.PROPERTY_SOURCE=org.apache.tomcat.util.digester.EnvironmentPropertySource' >> /usr/local/tomcat/conf/catalina.properties
echo "RDF4J_DATA_DIR is set to: ${RDF4J_DATA_DIR}"

/usr/local/tomcat/modify_web_xml.sh

echo "showing rdf4j data directory"
ls -l /rdf4j-data

export JAVA_OPTS="-Dorg.eclipse.rdf4j.appdata.basedir=${RDF4J_DATA_DIR}"
export CATALINA_OPTS="-Dorg.eclipse.rdf4j.appdata.basedir=${RDF4J_DATA_DIR}"
echo "JAVA_OPTS=\"\$JAVA_OPTS -Dorg.eclipse.rdf4j.appdata.basedir=${RDF4J_DATA_DIR}\"" >> /usr/local/tomcat/bin/setenv.sh

# Start Web Application
catalina.sh run
