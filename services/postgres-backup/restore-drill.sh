#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"
: "${AWS_DEFAULT_REGION:?AWS_DEFAULT_REGION is required}"
: "${ENDPOINT:?ENDPOINT is required}"
: "${BUCKET:?BUCKET is required}"
: "${BACKUP_OBJECT_KEY:?BACKUP_OBJECT_KEY is required}"

umask 077
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT HUP INT TERM
backup_file="$work_dir/restore.dump"

aws s3 cp "s3://$BUCKET/$BACKUP_OBJECT_KEY" "$backup_file" \
  --endpoint-url "$ENDPOINT" \
  --region "$AWS_DEFAULT_REGION" \
  --only-show-errors
pg_restore --list "$backup_file" >/dev/null
pg_restore --dbname "$DATABASE_URL" --exit-on-error --single-transaction --no-owner --no-acl "$backup_file"

verification="$(psql "$DATABASE_URL" -XAt -F '|' -v ON_ERROR_STOP=1 -c "
  SELECT
    count(*) FILTER (WHERE task.state = 'completed' AND job.id IS NOT NULL AND effect.id IS NOT NULL),
    count(*) FILTER (WHERE task.state = 'completed' AND (job.id IS NULL OR effect.id IS NULL))
  FROM public.platform_smoke_tasks AS task
  LEFT JOIN pgboss.job AS job ON job.id = task.id
  LEFT JOIN public.platform_smoke_effects AS effect ON effect.id = task.id;
")"
completed_with_job_and_effect="${verification%%|*}"
completed_with_missing_rows="${verification##*|}"

case "$completed_with_job_and_effect" in
  ''|*[!0-9]*) echo 'Restore verification query returned an invalid result' >&2; exit 1 ;;
esac
case "$completed_with_missing_rows" in
  ''|*[!0-9]*) echo 'Restore verification query returned an invalid result' >&2; exit 1 ;;
esac
if [ "$completed_with_job_and_effect" -lt 1 ] || [ "$completed_with_missing_rows" -ne 0 ]; then
  echo 'Restore verification did not find completed tasks with retained jobs and effects' >&2
  exit 1
fi

printf 'Restore verified: completed_tasks_with_retained_job_and_effect=%s; completed_tasks_missing_rows=%s\n' \
  "$completed_with_job_and_effect" "$completed_with_missing_rows"
