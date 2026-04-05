import os
import boto3
from botocore.exceptions import NoCredentialsError, ClientError

# Configuration from Environment Variables
# If AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set, boto3 picks them up automatically.
# We also use S3_BUCKET_NAME and S3_ENDPOINT_URL specifically to support Cloudflare R2 or other providers
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")
S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL")
S3_ENABLED = S3_BUCKET_NAME is not None and S3_BUCKET_NAME.strip() != ""

def get_s3_client():
    if not S3_ENABLED:
        return None
    
    # If S3_ENDPOINT_URL is provided, we use it (required for Cloudflare R2 / Custom S3)
    if S3_ENDPOINT_URL:
        return boto3.client('s3', endpoint_url=S3_ENDPOINT_URL)
    return boto3.client('s3')

def download_all():
    """Downloads all contents from the bucket to the local directory (handles reboots)"""
    client = get_s3_client()
    if not client:
        return False
        
    print(f"[*] S3 Sync: Downloading all files from bucket '{S3_BUCKET_NAME}'...")
    try:
        # Paginator handles buckets with >1000 objects
        paginator = client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=S3_BUCKET_NAME)

        download_count = 0
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    s3_key = obj['Key']
                    
                    # Create local directories if they don't exist
                    local_file_path = os.path.join(".", s3_key)
                    local_dir = os.path.dirname(local_file_path)
                    if local_dir:
                        os.makedirs(local_dir, exist_ok=True)
                        
                    # Skip downloading if the key itself is just a folder
                    if not s3_key.endswith('/'):
                        client.download_file(S3_BUCKET_NAME, s3_key, local_file_path)
                        download_count += 1

        print(f"[✓] S3 Sync: successfully downloaded {download_count} files.")
        return True
    except Exception as e:
        print(f"!! S3 Sync Error (Download): {e}")
        return False

def upload_file(local_file_path, s3_key=None):
    """Uploads a specific file (e.g., contests.json)"""
    client = get_s3_client()
    if not client:
        return False
        
    if not s3_key:
        s3_key = os.path.normpath(local_file_path).lstrip('./')
        
    if not os.path.exists(local_file_path):
        return False
        
    try:
        client.upload_file(local_file_path, S3_BUCKET_NAME, s3_key)
        print(f"[✓] S3 Sync: Uploaded file '{s3_key}'")
        return True
    except Exception as e:
        print(f"!! S3 Sync Error (Upload File): {e}")
        return False

def upload_directory(local_dir_path):
    """Recursively uploads a directory (e.g., resources/contest_report_slug)"""
    client = get_s3_client()
    if not client:
        return False
        
    if not os.path.exists(local_dir_path):
        return False
        
    print(f"[*] S3 Sync: Uploading directory '{local_dir_path}'...")
    upload_count = 0
    try:
        for root, dirs, files in os.walk(local_dir_path):
            for file in files:
                local_file = os.path.join(root, file)
                # Ensure the S3 path matches the relative structural path
                s3_key = os.path.normpath(local_file).lstrip('.').lstrip('/').lstrip('\\\\') # removing leading slashes
                client.upload_file(local_file, S3_BUCKET_NAME, s3_key)
                upload_count += 1
                
        print(f"[✓] S3 Sync: successfully uploaded {upload_count} files from '{local_dir_path}'.")
        return True
    except Exception as e:
        print(f"!! S3 Sync Error (Upload Dir): {e}")
        return False
