#!/bin/bash
set -e
set -x

echo "Starting EBS mount script"

# Install AWS CLI
yum install -y unzip aws-cli

DEVICE="/dev/xvdf"
MOUNT_POINT="/mnt/rdf4j-data"

# Get instance ID and region
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s)
INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id -s)
REGION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region -s)

echo "Instance ID: $INSTANCE_ID"
echo "Region: $REGION"

# Set the AWS region
export AWS_DEFAULT_REGION=$REGION

# Get EBS volume ID (passed as an environment variable in user data)
EBS_VOLUME_ID="${EBS_VOLUME_ID}"
echo "EBS Volume ID: $EBS_VOLUME_ID"

# Attach the EBS volume if not already attached
aws ec2 attach-volume --volume-id $EBS_VOLUME_ID --instance-id $INSTANCE_ID --device $DEVICE

# Wait for the device to be available
TIMEOUT=60
for i in $(seq 1 $TIMEOUT); do
    if [ -e $DEVICE ]; then
        echo "$DEVICE is now available"
        break
    fi
    if [ $i -eq $TIMEOUT ]; then
        echo "Timeout waiting for $DEVICE to become available"
        exit 1
    fi
    echo "Waiting for $DEVICE... ($i/$TIMEOUT)"
    sleep 5
done

# List block devices
lsblk

# Check if the device is already formatted
if ! blkid $DEVICE; then
    echo "Formatting $DEVICE..."
    mkfs -t ext4 $DEVICE
else
    echo "$DEVICE is already formatted"
fi

# Mount the volume with more permissive options
mkdir -p $MOUNT_POINT
if mount -o rw,exec,auto $DEVICE $MOUNT_POINT; then
    echo "Successfully mounted $DEVICE to $MOUNT_POINT"
else
    echo "Failed to mount $DEVICE to $MOUNT_POINT"
    exit 1
fi

# Ensure the mount persists across reboots
echo "$DEVICE $MOUNT_POINT ext4 defaults,nofail 0 2" | tee -a /etc/fstab

# Set appropriate permissions
chown -R 1000:1000 $MOUNT_POINT

# Set very permissive permissions (be cautious with this in production)
chmod 777 $MOUNT_POINT

echo "EBS mount script completed successfully"
