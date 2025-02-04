#!/bin/bash

get_mdb_dirs() {
    local src_path="$1"
    local -a mdb_dirs

    while IFS= read -r -d '' dir; do
        mdb_dirs+=("$(basename "$dir")")
    done < <(find "$src_path" -mindepth 1 -maxdepth 1 -type d -print0 | while IFS= read -r -d '' dir; do
        if [ -n "$(find "$dir" -name '*.mdb' -print -quit)" ]; then
            printf '%s\0' "$dir"
        fi
    done)

    echo "${mdb_dirs[@]}"
}

# Function to initialize from master
init_from_master() {
  echo "Initializing from master node..."
  
  # Wait for the shared data directory to be available
  until [ -d "/shared-data/server/repositories/kms" ]; do
    echo "Waiting for shared data directory..."
    sleep 5
  done

  # Ensure the local data directory exists
  mkdir -p ${RDF4J_DATA_DIR}/server/repositories

  # First, recursively copy all non-.mdb files
  echo "Copying all files from master..."
  cp -r /shared-data/server/repositories/kms ${RDF4J_DATA_DIR}/server/repositories/kms

  src_path="/shared-data/server/repositories/kms"
  mdb_dirs=($(get_mdb_dirs "$src_path"))

  for dir in "${mdb_dirs[@]}"; do
      src_dir="${src_path}/${dir}"
      dest_dir="${RDF4J_DATA_DIR}/server/repositories/kms/${dir}"

      echo "Copying $src_dir using mdb_copy to $dest_dir"
      rm -rf "$dest_dir"
      mkdir "$dest_dir"
      /bin/mdb_copy "$src_dir" "$dest_dir"

      if [ $? -eq 0 ]; then
          echo "Successfully copied $src_dir"
      else
          echo "Failed to copy $src_dir"
          exit 1
      fi
  done

  # Remove only lock directories, not lock.mdb files
  echo "Removing directory level lock..."
  find ${RDF4J_DATA_DIR}/server/repositories/kms -name "lock" -type d -exec rm -rf {} +

  echo "Initialization from master complete"
}

# Call the function
init_from_master
