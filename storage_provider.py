import os
import shutil
import logging
from abc import ABC, abstractmethod
from typing import BinaryIO, List
from dotenv import load_dotenv
from google.cloud import storage

# Ensure environment variables are loaded
load_dotenv()

logger = logging.getLogger("wecloud.storage")

class StorageProvider(ABC):
    @abstractmethod
    def upload_file(self, file_obj: BinaryIO, storage_filename: str) -> None:
        """Upload a file object to the storage backend."""
        pass

    @abstractmethod
    def download_file(self, storage_filename: str, chunk_size: int | None = None) -> BinaryIO:
        """Retrieve a file as a binary stream from the storage backend."""
        pass

    @abstractmethod
    def delete_file(self, storage_filename: str) -> None:
        """Delete a file from the storage backend."""
        pass

    @abstractmethod
    def file_exists(self, storage_filename: str) -> bool:
        """Check if a file exists in the storage backend."""
        pass

    @abstractmethod
    def list_files(self) -> List[str]:
        """List all stored filenames in the storage backend."""
        pass

    @abstractmethod
    def get_file_size(self, storage_filename: str) -> int:
        """Get the file size in bytes from the storage backend."""
        pass

    @abstractmethod
    def check_health(self) -> bool:
        """Test if the storage system is responsive and healthy."""
        pass


class LocalStorageProvider(StorageProvider):
    def __init__(self, upload_folder: str = "uploads"):
        self.upload_folder = upload_folder
        if not os.path.exists(self.upload_folder):
            os.makedirs(self.upload_folder)

    def upload_file(self, file_obj: BinaryIO, storage_filename: str) -> None:
        dest_path = os.path.join(self.upload_folder, storage_filename)
        with open(dest_path, "wb") as dest:
            shutil.copyfileobj(file_obj, dest)

    def download_file(self, storage_filename: str, chunk_size: int | None = None) -> BinaryIO:
        src_path = os.path.join(self.upload_folder, storage_filename)
        if not os.path.exists(src_path):
            raise FileNotFoundError(f"File {storage_filename} not found locally.")
        return open(src_path, "rb")

    def delete_file(self, storage_filename: str) -> None:
        src_path = os.path.join(self.upload_folder, storage_filename)
        if os.path.exists(src_path):
            os.remove(src_path)

    def file_exists(self, storage_filename: str) -> bool:
        src_path = os.path.join(self.upload_folder, storage_filename)
        return os.path.exists(src_path)

    def list_files(self) -> List[str]:
        if not os.path.exists(self.upload_folder):
            return []
        return os.listdir(self.upload_folder)

    def get_file_size(self, storage_filename: str) -> int:
        src_path = os.path.join(self.upload_folder, storage_filename)
        if not os.path.exists(src_path):
            raise FileNotFoundError(f"File {storage_filename} not found locally.")
        return os.path.getsize(src_path)

    def check_health(self) -> bool:
        try:
            temp_file = os.path.join(self.upload_folder, ".healthcheck")
            with open(temp_file, "w") as f:
                f.write("OK")
            os.remove(temp_file)
            return True
        except Exception as e:
            logger.error(f"LocalStorageProvider healthcheck failed: {e}")
            return False


class GoogleCloudStorageProvider(StorageProvider):
    def __init__(self, bucket_name: str, credentials_path: str = None):
        if credentials_path:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
        self.client = storage.Client()
        self.bucket_name = bucket_name
        self.bucket = self.client.bucket(self.bucket_name)
        self.is_active = True
        self._verify_bucket()

    def _verify_bucket(self) -> None:
        try:
            if not self.bucket.exists():
                logger.error(
                    f"GCS Configuration Error: GCS Bucket '{self.bucket_name}' "
                    "does not exist. GoogleCloudStorageProvider is gracefully disabled."
                )
                self.is_active = False
            else:
                logger.info(f"GCS Bucket '{self.bucket_name}' verified successfully.")
        except Exception as e:
            logger.error(
                f"GCS Connection Error: Failed to verify existence of bucket '{self.bucket_name}': {e}. "
                "GoogleCloudStorageProvider is gracefully disabled."
            )
            self.is_active = False

    def upload_file(self, file_obj: BinaryIO, storage_filename: str) -> None:
        if not self.is_active:
            raise RuntimeError("GCS Storage Provider is disabled (bucket is missing or inaccessible).")
        blob = self.bucket.blob(storage_filename)
        # Ensure standard read compatibility by seeking to 0 if supported
        try:
            file_obj.seek(0)
        except Exception:
            pass
        blob.upload_from_file(file_obj)

    def download_file(self, storage_filename: str, chunk_size: int | None = None) -> BinaryIO:
        if not self.is_active:
            raise RuntimeError("GCS Storage Provider is disabled (bucket is missing or inaccessible).")
        blob = self.bucket.blob(storage_filename)
        # BlobReader fetches only the requested chunks; it never materializes the
        # whole object in memory or creates a temporary file.
        return blob.open("rb", chunk_size=chunk_size)

    def delete_file(self, storage_filename: str) -> None:
        if not self.is_active:
            raise RuntimeError("GCS Storage Provider is disabled (bucket is missing or inaccessible).")
        blob = self.bucket.blob(storage_filename)
        blob.delete()

    def file_exists(self, storage_filename: str) -> bool:
        if not self.is_active:
            return False
        blob = self.bucket.blob(storage_filename)
        return blob.exists()

    def list_files(self) -> List[str]:
        if not self.is_active:
            return []
        blobs = self.client.list_blobs(self.bucket_name)
        return [blob.name for blob in blobs]

    def get_file_size(self, storage_filename: str) -> int:
        if not self.is_active:
            raise RuntimeError("GCS Storage Provider is disabled (bucket is missing or inaccessible).")
        blob = self.bucket.blob(storage_filename)
        blob.reload()
        if blob.size is None:
            raise FileNotFoundError(f"File {storage_filename} has no size metadata or does not exist in GCS.")
        return blob.size

    def check_health(self) -> bool:
        if not self.is_active:
            return False
        try:
            # Simple check if the bucket exists/is accessible
            return self.bucket.exists()
        except Exception as e:
            logger.error(f"GoogleCloudStorageProvider healthcheck failed: {e}")
            return False


def get_storage_provider() -> StorageProvider:
    provider_type = os.getenv("STORAGE_PROVIDER", "local").lower().strip()
    if provider_type == "gcs":
        bucket_name = os.getenv("GCS_BUCKET_NAME", "wecloud-storage-23070709")
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        return GoogleCloudStorageProvider(bucket_name, credentials_path)
    else:
        upload_folder = os.getenv("UPLOAD_FOLDER", "uploads")
        return LocalStorageProvider(upload_folder)
