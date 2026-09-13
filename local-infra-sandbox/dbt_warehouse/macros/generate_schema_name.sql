{#
    Đặt model vào ĐÚNG database đã khai, không ghép tiền tố.

    Mặc định dbt ghép: target.schema + '_' + schema của model, ra
    `default_warehouse`. Với ClickHouse thì `schema` chính là database, và ta
    muốn tên thuần: masterdata / staging / warehouse / serving / audit.

    Model không khai schema thì rơi về schema của target (default).
#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
