"# Archive Processor Scripts

This directory contains a set of Node.js scripts designed to manage the lifecycle of KMS data, from downloading RDF files from an S3 bucket to processing them and uploading the resulting CSV files back to S3.

## Scripts

-   `download-rdf-from-S3.js`: Downloads versioned RDF files from the configured S3 bucket into the local `archive-processor/downloaded-rdf` directory.
-   `process-rdf.js`: Orchestrates a complex workflow that uses the downloaded RDF files. For each version, it loads the RDF data into an RDF4J repository and then triggers a local KMS application to generate corresponding CSV files in the `archive-processor/local-kms-csv` directory.
-   `upload-csv-to-S3.js`: Uploads the generated CSV files from the `archive-processor/local-kms-csv` directory to the configured S3 bucket.

## Configuration

All scripts are configured via a single, centralized shell script:

`archive-processor/scripts/scripts-config.sh`

The settings in this file are loaded automatically when you use the `npm run` commands for these scripts.

This file allows you to set:
-   The S3 bucket name and AWS region.
-   Your AWS profile.
-   Delays between S3 API calls to prevent rate-limiting.
-   Specific lists of versions to download, upload, or process.

## Recommended Workflow

The scripts are designed to be run in a specific sequence. Ensure all prerequisites are met before starting.

### Prerequisites

-   **Node.js and Dependencies**: You must have Node.js installed and have run `npm install` from the project root.
-   **AWS Credentials**: Your AWS credentials must be configured locally, typically via the `~/.aws/credentials` file. Ensure you have access to the target S3 bucket.
-   **Running Services**: The `process-rdf` script requires running instances of **RDF4J** and **Redis** that are accessible to the script. The default URLs are `http://127.0.0.1:8081` for RDF4J and `redis://localhost:6380` for Redis.

### Step 1: Configure Your Environment

1.  Open `archive-processor/scripts/scripts-config.sh` in your editor.
2.  Set the `S3_BUCKET_NAME` and `AWS_PROFILE` if they differ from the defaults.
3.  Optionally, specify which versions you want to work with using the `TO_BE_DOWNLOADED_VERSIONS`, `TO_BE_PROCESSED_VERSIONS`, and `TO_BE_UPLOADED_VERSIONS` variables. If you leave them empty, the scripts will process all available versions.

### Step 2: Download RDF Files from S3

This step populates the `archive-processor/downloaded-rdf` directory with the master RDF files from S3.

```shell
npm run download-rdf
```

### Step 3: Process RDFs and Generate CSVs

This is the main processing step. It reads the downloaded RDF files, loads them into RDF4J, and then uses a local application endpoint to generate CSV files in the `archive-processor/local-kms-csv` directory.

**Important**: Ensure your RDF4J and Redis services are running before executing this command.

```shell
npm run process-rdf
```

### Step 4: Upload Generated CSVs to S3

This final step takes the newly created CSV files from the `local-kms-csv` directory and uploads them to the correct versioned path in your S3 bucket.

```shell
npm run upload-csv
```

By following these steps, you can perform a full download-process-upload cycle for your KMS data."