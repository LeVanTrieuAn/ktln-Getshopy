FROM python:3.11-slim

WORKDIR /dbt

RUN pip install dbt-clickhouse==1.8.0

COPY . .

RUN dbt deps