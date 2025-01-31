FROM eclipse/rdf4j-workbench:4.3.15
USER root

# Create the directory for EFS mount and set permissions
RUN mkdir -p /rdf4j-data
RUN chown -R tomcat:nogroup /rdf4j-data
RUN chmod -R 755 /rdf4j-data

# Set the RDF4J data directory
ENV RDF4J_DATA_DIR=/rdf4j-data

# Install necessary tools
RUN apt-get update && apt-get install -y unzip zip

# Copy configuration files
COPY config/tomcat-users.xml /usr/local/tomcat/conf/tomcat-users.xml

# Copy scripts
COPY scripts/setup.sh /usr/local/tomcat/setup.sh
COPY scripts/modify_web_xml.sh /usr/local/tomcat/modify_web_xml.sh

RUN chown -R tomcat:nogroup /usr/local/tomcat
RUN rm -r /usr/local/tomcat/webapps/rdf4j-workbench*
USER tomcat

# Run setup script
CMD ["/usr/local/tomcat/setup.sh"]

