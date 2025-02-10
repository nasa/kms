FROM eclipse/rdf4j-workbench:latest
USER root

# Create the directory for EFS mount and set permissions
RUN mkdir -p /rdf4j-data
RUN chown -R tomcat:nogroup /rdf4j-data
RUN chmod -R 755 /rdf4j-data

# Set the RDF4J data directory
ENV RDF4J_DATA_DIR=/rdf4j-data

# Install necessary tools
RUN apt-get update && apt-get install -y unzip zip liblmdb-dev

# Copy configuration files
COPY config/tomcat-users.xml /usr/local/tomcat/conf/tomcat-users.xml

# Copy scripts
COPY scripts/setup.sh /usr/local/tomcat/setup.sh
COPY scripts/setup_web_auth.sh /usr/local/tomcat/setup_web_auth.sh
COPY scripts/create_repository.sh /usr/local/tomcat/create_repository.sh

RUN chown -R tomcat:nogroup /usr/local/tomcat
# RUN rm -r /usr/local/tomcat/webapps/rdf4j-workbench*

# We'll keep the container running as root to allow permission changes at runtime
# The entrypoint script will switch to the tomcat user

# Set correct permissions
RUN chown -R tomcat:nogroup /rdf4j-data
RUN chmod -R 755 /rdf4j-data

USER tomcat

# Use the new entrypoint script
CMD ["/usr/local/tomcat/setup.sh"]