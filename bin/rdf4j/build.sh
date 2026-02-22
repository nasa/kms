#!/usr/bin/env bash
set -euo pipefail

docker build -t rdf4j:latest ./cdk/rdfdb/docker
