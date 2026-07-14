import os
from google.cloud import storage

# Parse the .env file manually to get credentials and bucket name
credentials_path = None
bucket_name = None

if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                if key.strip() == "GOOGLE_APPLICATION_CREDENTIALS":
                    credentials_path = val.strip()
                elif key.strip() == "GCS_BUCKET_NAME":
                    bucket_name = val.strip()

print(f"Using Google Application Credentials: {credentials_path}")
print(f"Using Bucket Name: {bucket_name}")

if credentials_path:
    # Set the environment variable so the storage Client can find it
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path

try:
    client = storage.Client()
    if bucket_name:
        bucket = client.bucket(bucket_name)
        exists = bucket.exists()
        print(f"Bucket '{bucket_name}' exists: {exists}")
    else:
        print("Error: GCS_BUCKET_NAME not found in .env file.")
except Exception as e:
    print(f"Error connecting to GCS: {e}")
