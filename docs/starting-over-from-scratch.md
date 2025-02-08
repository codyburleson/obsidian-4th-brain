

Change into the supabase/docker directory:

```bash
cd ~/repos/supabase/docker
```

Stop docker and remove volumes:

```
docker compose down -v
```

Remove Postgres data:

```
rm -rf volumes/db/data
```

Start docker:

```
docker compose -f docker-compose.yml -f docker-compose.s3.yml up -d
```
