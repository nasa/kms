#!/bin/bash

# Auto Scaling Group Instance Refresh Script for RDF4J Single-Writer Setup
# 
# Purpose: This script performs a controlled refresh of a single instance in an Auto Scaling Group (ASG)
# associated with an ECS cluster running an RDF4J database. It's designed specifically to maintain
# a single-instance environment, which is crucial for RDF4J's 1-writer constraint.
#
# Key Features:
# - Ensures only one instance is running at any time, adhering to RDF4J's single-writer requirement
# - Performs a complete shutdown of the existing instance before starting a new one
# - Minimizes downtime while maintaining data integrity
# - Waits for ECS services to stabilize, ensuring the RDF4J database is fully operational
# - Useful for applying AMI updates or other instance-level changes that require a full instance replacement
# - Optionally refreshes the ECS image selection after the old host has shut down
#
# Usage: bin/refresh_asg.sh [--force-new-deployment]
# The optional flag picks up an updated image under the service's existing tag.
# Both modes cause downtime and use the active AWS CLI account and region.
#
# IMPORTANT: This script is tailored for an RDF4J setup that permits at most one instance to be running
# due to the database's 1-writer limitation. Modifying this script to allow multiple instances
# could lead to data corruption or inconsistencies in the RDF4J database.

set -e

FORCE_NEW_DEPLOYMENT=false
for argument in "$@"; do
    case "$argument" in
        --force-new-deployment) FORCE_NEW_DEPLOYMENT=true ;;
        -h|--help)
            echo "Usage: $0 [--force-new-deployment]"
            echo "Replaces the RDF4J EC2 host with downtime; optionally refreshes the ECS image selection."
            exit 0
            ;;
        *)
            echo "Unknown argument: $argument" >&2
            echo "Usage: $0 [--force-new-deployment]" >&2
            exit 1
            ;;
    esac
done

# Function to log messages with timestamp
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Get the Auto Scaling Group name
get_asg_name() {
    aws ecs list-clusters --query "clusterArns[?contains(@, 'rdf4jEcs')]" --output text | \
    xargs aws ecs describe-clusters --clusters --query "clusters[0].capacityProviders[0]" --output text | \
    xargs aws ecs describe-capacity-providers --capacity-providers --query "capacityProviders[0].autoScalingGroupProvider.autoScalingGroupArn" --output text | \
    awk -F/ '{print $NF}'
}

ASG_NAME=$(get_asg_name)
log "Using Auto Scaling Group: $ASG_NAME"

# Get the ECS cluster name
CLUSTER_NAME=$(aws ecs list-clusters --query "clusterArns[?contains(@, 'rdf4jEcs')]" --output text | awk -F/ '{print $NF}')
SERVICE_NAME=$(aws ecs list-services --cluster $CLUSTER_NAME --query "serviceArns[0]" --output text | awk -F/ '{print $NF}')

# Set everything to 0
log "Setting min, max, and desired capacity to 0..."
aws autoscaling update-auto-scaling-group --auto-scaling-group-name $ASG_NAME --min-size 0 --max-size 0 --desired-capacity 0

# Wait for instances to be terminated
log "Waiting for instances to be terminated..."
while true; do
    INSTANCE_COUNT=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG_NAME --query "length(AutoScalingGroups[0].Instances)" --output text)
    if [ "$INSTANCE_COUNT" -eq 0 ]; then
        log "All instances terminated"
        break
    fi
    log "Instances still running: $INSTANCE_COUNT"
    sleep 30
done

# Verify complete shutdown
log "Verifying complete shutdown..."
TIMEOUT=300  # 5 minutes timeout
START_TIME=$(date +%s)

while true; do
    # Check if the ASG has any instances
    ASG_INSTANCES=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG_NAME --query 'length(AutoScalingGroups[0].Instances)' --output text)
    
    # Check for any ECS container instances
    ECS_INSTANCES=$(aws ecs list-container-instances --cluster $CLUSTER_NAME --query 'length(containerInstanceArns)' --output text)
    
    if [ "$ASG_INSTANCES" -eq 0 ] && [ "$ECS_INSTANCES" -eq 0 ]; then
        log "Shutdown complete: No instances in ASG and no ECS container instances"
        break
    fi
    
    CURRENT_TIME=$(date +%s)
    if (( CURRENT_TIME - START_TIME > TIMEOUT )); then
        # Never restore capacity without confirming shutdown of the previous writer.
        log "Shutdown verification timed out. Leaving ASG capacity at zero; investigate before restoring it."
        exit 1
    fi
    
    log "Still waiting for complete shutdown. ASG instances: $ASG_INSTANCES, ECS container instances: $ECS_INSTANCES"
    sleep 10
done

if [ "$FORCE_NEW_DEPLOYMENT" = true ]; then
    # A replacement host can reuse the old ECS deployment's image digest. Refresh it
    # while host capacity is zero so the new image cannot start beside the old writer.
    log "Forcing a new ECS deployment before restoring host capacity..."
    if ! aws ecs update-service --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME" \
        --force-new-deployment --query 'service.serviceArn' --output text; then
        log "ECS deployment request failed. Leaving ASG capacity at zero; investigate before restoring it."
        exit 1
    fi
fi

# Set everything back to 1
log "Setting min, max, and desired capacity back to 1..."
aws autoscaling update-auto-scaling-group --auto-scaling-group-name $ASG_NAME --min-size 1 --max-size 1 --desired-capacity 1

# Wait for new instance to be in service
log "Waiting for new instance to be in service..."
while true; do
    INSTANCE_COUNT=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG_NAME --query "length(AutoScalingGroups[0].Instances[?LifecycleState=='InService'])" --output text)
    if [ "$INSTANCE_COUNT" -eq 1 ]; then
        log "New instance is now in service"
        break
    fi
    log "Waiting for instance to be in service..."
    sleep 30
done

# Wait for ECS service to be stable
log "Waiting for ECS service to be stable..."
aws ecs wait services-stable --cluster $CLUSTER_NAME --services $SERVICE_NAME

log "Refresh process completed. New instance is now in service and ECS tasks should be running."
