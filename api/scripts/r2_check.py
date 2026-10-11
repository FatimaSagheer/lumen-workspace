import boto3
import httpx
from botocore.config import Config

from app.config import settings

assert settings.s3_endpoint and settings.s3_access_key, "Fill in S3_* values in .env first"

s3 = boto3.client(
    "s3",
    endpoint_url=settings.s3_endpoint,
    aws_access_key_id=settings.s3_access_key,
    aws_secret_access_key=settings.s3_secret_key,
    region_name="auto",
    config=Config(signature_version="s3v4"),
)

key = "healthcheck/hello.txt"

# 1. Make a short-lived permission slip to upload ONE object (what the API will do)
url = s3.generate_presigned_url(
    "put_object",
    Params={"Bucket": settings.s3_bucket, "Key": key, "ContentType": "text/plain"},
    ExpiresIn=300,
)

# 2. Upload using only that URL (what the browser will do)
r = httpx.put(url, content=b"hello lumen", headers={"Content-Type": "text/plain"})
print("upload status:", r.status_code)

# 3. Read it back with the key (what the worker will do)
body = s3.get_object(Bucket=settings.s3_bucket, Key=key)["Body"].read()
print("read back:", body)

# 4. Clean up
s3.delete_object(Bucket=settings.s3_bucket, Key=key)
print("deleted. R2 works.")
