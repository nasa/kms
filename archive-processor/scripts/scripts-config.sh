#!/bin/bash

# -----------------------------------------------------------------------------
# Unified Configuration for S3 Scripts
# -----------------------------------------------------------------------------
# This file contains settings for both downloading RDF files from S3 and
# uploading CSV files to S3.
#
# To use, load these environment variables into your session before running
# a script, for example:
#
#   source archive-processor/scripts/scripts_config.sh
#   npm run download-rdf
#
# -----------------------------------------------------------------------------


# =============================================================================
# Common AWS & S3 Settings (Used by all scripts)
# =============================================================================

# AWS S3 bucket name for all operations
export S3_BUCKET_NAME="kms-rdf-backup-sit"

# AWS Region for the S3 bucket
export AWS_REGION="us-east-1"

# Optional: Specify an AWS profile to use for authentication.
# If this is commented out, the script will use default credential resolution.
# export AWS_PROFILE="your-aws-profile"



# =============================================================================
# RDF Downloader Settings (for download-rdf-from-S3.js)
# =============================================================================

# Delay in milliseconds between downloads to avoid rate limiting.
export DOWNLOAD_DELAY_MS="100"

# Optional: Comma-separated list of specific versions to download.
# If this string is empty, the script will download all RDF files.
# Example: export TO_BE_DOWNLOADED_VERSIONS="10.0,11.0,KMS-654-Testing"
export TO_BE_DOWNLOADED_VERSIONS=""


# =============================================================================
# RDF Processor Settings (for process-rdf.js)
# =============================================================================

# Optional: Comma-separated list of specific versions to process from the
# 'downloaded-rdf' directory. If empty, all found RDF files will be processed.
# Example: export TO_BE_PROCESSED_VERSIONS="10.0,KMS-123"
export TO_BE_PROCESSED_VERSIONS=""

# Delay in milliseconds to wait between downloading each concept scheme CSV file.
export PROCESS_CSV_DOWNLOAD_DELAY_MS="100"

# Delay in milliseconds to wait between processing each version (RDF file).
export PROCESS_VERSION_DELAY_MS="5000"


# =============================================================================
# CSV Uploader Settings (for upload-csv-to-S3.js)
# =============================================================================

# Delay in milliseconds between uploads to avoid rate limiting.
export UPLOAD_DELAY_MS="100"

# Optional: Comma-separated list of specific versions to upload.
# If this string is empty, the script will upload all CSV files from all version folders.
# Example: export TO_BE_UPLOADED_VERSIONS="10.0,11.0"
export TO_BE_UPLOADED_VERSIONS=""