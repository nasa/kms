#!/bin/bash
set -x  # This will print each command as it's executed
set -e

echo "FUSEKI_BASE is set to: ${FUSEKI_BASE}"

# Set up authentication if ADMIN_PASSWORD is provided
if [ -z "$ADMIN_PASSWORD" ]; then
    echo "ADMIN_PASSWORD is not set. Exiting."
    exit 1
fi

echo "Setting up authentication for Fuseki"

# Create the password file
touch "${FUSEKI_BASE}/passwd"

# Add the admin user to the password file
echo "admin:${ADMIN_PASSWORD}" > "${FUSEKI_BASE}/passwd"
echo "Contents of passwd file:"
cat "${FUSEKI_BASE}/passwd"

# Create the security configuration file
cat > "${FUSEKI_BASE}/shiro.ini" <<EOL
[users]
admin = ${ADMIN_PASSWORD}, admin

[roles]
admin = *

[urls]
/$/ping = anon
/$/status = anon
/** = authcBasic,roles[admin]
EOL

echo "Contents of shiro.ini file:"
cat "${FUSEKI_BASE}/shiro.ini"

echo "Authentication set up completed"

sh create_repository.sh &
# Start Fuseki
echo "Starting Fuseki with authentication"
exec /fuseki/fuseki-server --passwd="${FUSEKI_BASE}/passwd" --auth=basic
