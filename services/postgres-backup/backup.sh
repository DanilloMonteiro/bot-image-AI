#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"
: "${AWS_DEFAULT_REGION:?AWS_DEFAULT_REGION is required}"
: "${ENDPOINT:?ENDPOINT is required}"
: "${BUCKET:?BUCKET is required}"
: "${BACKUP_RETENTION_DAYS:?BACKUP_RETENTION_DAYS is required}"

case "$BACKUP_RETENTION_DAYS" in
  ''|*[!0-9]*) echo 'BACKUP_RETENTION_DAYS must be a positive integer' >&2; exit 2 ;;
esac
if [ "$BACKUP_RETENTION_DAYS" -lt 1 ]; then
  echo 'BACKUP_RETENTION_DAYS must be a positive integer' >&2
  exit 2
fi

umask 077
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT HUP INT TERM

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$work_dir/postgres-$timestamp.dump"
backup_key="postgres/$timestamp.dump"

pg_dump --dbname "$DATABASE_URL" --format=custom --no-owner --no-acl --file "$backup_file"
pg_restore --list "$backup_file" >/dev/null

aws s3 cp "$backup_file" "s3://$BUCKET/$backup_key" \
  --endpoint-url "$ENDPOINT" \
  --region "$AWS_DEFAULT_REGION" \
  --only-show-errors

local_bytes="$(wc -c < "$backup_file" | tr -d '[:space:]')"
remote_bytes="$(aws s3api head-object \
  --bucket "$BUCKET" \
  --key "$backup_key" \
  --endpoint-url "$ENDPOINT" \
  --region "$AWS_DEFAULT_REGION" \
  --query ContentLength \
  --output text)"
if [ "$local_bytes" != "$remote_bytes" ]; then
  echo 'Uploaded backup size does not match the local dump' >&2
  exit 1
fi
printf 'Backup uploaded and verified: key=%s bytes=%s\n' "$backup_key" "$local_bytes"

cutoff_epoch="$(date -u -d "$BACKUP_RETENTION_DAYS days ago" +%s)"
objects_file="$work_dir/objects.tsv"
aws s3api list-objects-v2 \
  --bucket "$BUCKET" \
  --prefix 'postgres/' \
  --endpoint-url "$ENDPOINT" \
  --region "$AWS_DEFAULT_REGION" \
  --query 'Contents[].[Key,LastModified]' \
  --output text > "$objects_file"

tab="$(printf '\t')"
while IFS="$tab" read -r object_key last_modified; do
  [ -n "$object_key" ] || continue
  [ "$object_key" = 'None' ] && continue
  object_epoch="$(date -u -d "$last_modified" +%s)"
  if [ "$object_epoch" -lt "$cutoff_epoch" ]; then
    aws s3api delete-object \
      --bucket "$BUCKET" \
      --key "$object_key" \
      --endpoint-url "$ENDPOINT" \
      --region "$AWS_DEFAULT_REGION" \
      --output json >/dev/null
    printf 'Expired backup removed: key=%s\n' "$object_key"
  fi
done < "$objects_file"

printf 'Backup run completed; retention_days=%s\n' "$BACKUP_RETENTION_DAYS"
