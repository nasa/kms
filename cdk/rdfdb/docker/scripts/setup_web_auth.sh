#!/bin/bash
set -e

WAR_FILE="/usr/local/tomcat/webapps/rdf4j-server.war"
TEMP_DIR="/tmp/rdf4j-server"

# Extract WAR file
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"
unzip -q "$WAR_FILE"

# Modify web.xml
WEB_XML="$TEMP_DIR/WEB-INF/web.xml"
# Use sed to insert the security configurations just before the closing </web-app> tag
sed -i '/<\/web-app>/i\
  <security-constraint>\
        <web-resource-collection>\
            <web-resource-name>RDF4J Server</web-resource-name>\
            <url-pattern>/protocol</url-pattern>\
        </web-resource-collection>\
        <!-- No auth-constraint here, making it publicly accessible --> \
    </security-constraint>\
\
    <security-constraint>\
        <web-resource-collection>\
            <web-resource-name>RDF4J Server</web-resource-name>\
            <url-pattern>/*</url-pattern>\
        </web-resource-collection>\
        <auth-constraint>\
            <role-name>rdf4j-user</role-name>\
        </auth-constraint>\
    </security-constraint>\
\
    <login-config>\
        <auth-method>BASIC</auth-method>\
        <realm-name>RDF4J Server</realm-name>\
    </login-config>\
\
    <security-role>\
        <role-name>rdf4j-user</role-name>\
    </security-role>\
    <security-role>\
        <role-name>rdf4j-admin</role-name>\
    </security-role>' "$WEB_XML"

# Repackage WAR file
cd "$TEMP_DIR"
zip -rq "$WAR_FILE" .

# Clean up
rm -rf "$TEMP_DIR"
