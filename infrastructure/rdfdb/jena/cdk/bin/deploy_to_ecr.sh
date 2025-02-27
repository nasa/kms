#!/bin/bash

# Set variables
REPO_NAME="jena"
REGION="us-east-1"
DOCKER_FILE_PATH="../docker"

# Create ECR repository
aws ecr create-repository --repository-name $REPO_NAME --region "us-east-1"

# Get the repository URI
REPO_URI=$(aws ecr describe-repositories --repository-names $REPO_NAME --region $REGION --query 'repositories[0].repositoryUri' --output text)

# Authenticate Docker to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REPO_URI

# Build Docker image
docker build -t $REPO_NAME $DOCKER_FILE_PATH

# Tag the image
docker tag $REPO_NAME:latest $REPO_URI:latest

# Push the image to ECR
docker push $REPO_URI:latest

echo "Docker image pushed to $REPO_URI:latest"
