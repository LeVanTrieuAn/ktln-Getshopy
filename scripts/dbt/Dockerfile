# dbt-core + adapter ClickHouse, chạy THỦ CÔNG (không scheduler).
#
#   docker compose --profile dbt run --rm dbt build
#   docker compose --profile dbt run --rm dbt test
FROM python:3.11-slim

RUN pip install --no-cache-dir \
      dbt-core==1.8.9 \
      dbt-clickhouse==1.8.5

WORKDIR /dbt
ENV DBT_PROFILES_DIR=/dbt
ENTRYPOINT ["dbt"]
CMD ["--help"]
