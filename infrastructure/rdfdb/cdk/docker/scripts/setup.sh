#!/bin/bash
set -e

echo 'org.apache.tomcat.util.digester.PROPERTY_SOURCE=org.apache.tomcat.util.digester.EnvironmentPropertySource' >> /usr/local/tomcat/conf/catalina.properties
echo "RDF4J_DATA_DIR is set to: ${RDF4J_DATA_DIR}"

/usr/local/tomcat/setup_web_auth.sh

export JAVA_OPTS="-Dorg.eclipse.rdf4j.appdata.basedir=${RDF4J_DATA_DIR}"
export CATALINA_OPTS="-Dorg.eclipse.rdf4j.appdata.basedir=${RDF4J_DATA_DIR}"
echo "JAVA_OPTS=\"\$JAVA_OPTS -Dorg.eclipse.rdf4j.appdata.basedir=${RDF4J_DATA_DIR}\"" >> /usr/local/tomcat/bin/setenv.sh
echo "Role for container is ${RDF4J_ROLE}"

# Check the role and perform appropriate actions
if [ "$RDF4J_ROLE" = "master" ]; then
  /usr/local/tomcat/create_repository.sh &
elif [ "$RDF4J_ROLE" = "slave" ]; then
  /usr/local/tomcat/init_from_master.sh
else
  echo "Unknown RDF4J_ROLE: $RDF4J_ROLE"
  exit 1
fi

# Start Web Application
catalina.sh run
