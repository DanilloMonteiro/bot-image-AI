FROM postgres:18-alpine

RUN apk add --no-cache aws-cli coreutils

COPY backup.sh /usr/local/bin/backup.sh
COPY restore-drill.sh /usr/local/bin/restore-drill.sh
RUN chmod 0755 /usr/local/bin/backup.sh /usr/local/bin/restore-drill.sh

