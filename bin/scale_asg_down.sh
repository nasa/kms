#!/bin/bash
set -e

echo "Finding RDF4J Auto Scaling Group..."
ASG_NAME=$(aws autoscaling describe-auto-scaling-groups \
    --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'rdf4jAutoScalingGroup')].AutoScalingGroupName" \
    --output text | awk '{print $1}')

if [ -z "$ASG_NAME" ] || [ "$ASG_NAME" == "None" ]; then
    echo "Could not find the RDF4J Auto Scaling Group. It might already be deleted!"
    exit 0
fi

echo "Found ASG: $ASG_NAME"
echo "Scaling down Min, Max, and Desired capacity to 0..."

aws autoscaling update-auto-scaling-group \
    --auto-scaling-group-name "$ASG_NAME" \
    --min-size 0 \
    --max-size 0 \
    --desired-capacity 0

echo "Waiting for instances to terminate..."
while true; do
    INSTANCE_COUNT=$(aws autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "$ASG_NAME" \
        --query "length(AutoScalingGroups[0].Instances)" \
        --output text)
        
    if [ "$INSTANCE_COUNT" -eq 0 ]; then
        echo "All instances successfully terminated!"
        break
    fi
    echo "Instances still running: $INSTANCE_COUNT. Waiting 10 seconds..."
    sleep 10
done
