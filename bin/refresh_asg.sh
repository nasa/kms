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
#
# IMPORTANT: This script is tailored for an RDF4J setup that requires exactly one instance to be running
# at all times due to the database's 1-writer limitation. Modifying this script to allow multiple instances
# could lead to data corruption or inconsistencies in the RDF4J database.

set -e

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
    # Check if there are any running ECS tasks
    RUNNING_TASKS=$(aws ecs list-tasks --cluster $CLUSTER_NAME --desired-status RUNNING --query 'length(taskArns)' --output text)
    
    # Check if the ASG has any instances
    ASG_INSTANCES=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG_NAME --query 'AutoScalingGroups[0].Instances' --output text)
    
    if [ "$RUNNING_TASKS" -eq 0 ] && [ -z "$ASG_INSTANCES" ]; then
        log "Shutdown complete: No running tasks and no instances in ASG"
        break
    fi
    
    CURRENT_TIME=$(date +%s)
    if (( CURRENT_TIME - START_TIME > TIMEOUT )); then
        log "Timeout reached while waiting for complete shutdown. Proceeding anyway..."
        break
    fi
    
    log "Still waiting for complete shutdown. Running tasks: $RUNNING_TASKS, ASG instances: $ASG_INSTANCES"
    sleep 10
done

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
