#!/bin/bash

# Set variables
REPO_NAME="rdf4j"
REGION="us-east-1"
DOCKER_FILE_PATH="../docker"

# Create ECR repository
aws ecr create-repository --repository-name $REPO_NAME --region "us-east-1"

# Get the repository URI
REPO_URI=$(aws ecr describe-repositories --repository-names $REPO_NAME --region $REGION --query 'repositories[0].repositoryUri' --output text)

# Authenticate Docker to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REPO_URI

# Set up a new builder instance
docker buildx create --name amd64builder --use

# Build and push Docker image for amd64 architecture
docker buildx build --platform=linux/amd64 -t $REPO_URI:latest --push $DOCKER_FILE_PATH

echo "Docker image built and pushed to $REPO_URI:latest"

# Clean up the builder
docker buildx rm amd64builder