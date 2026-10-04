{#
  Mã tầm giá của một cột giá, theo var `price_bands` (xếp tăng dần theo min).
  price_band('p.price') -> multiIf(p.price < 5000000, 'lt5', p.price < 15000000, '5to15', ..., 'gt30')
#}
{% macro price_band(col) -%}
    {%- set bands = var('price_bands') -%}
    multiIf(
    {%- for b in bands[1:] %}
        {{ col }} < {{ b.min }}, '{{ bands[loop.index0].id }}',
    {%- endfor %}
        '{{ bands[-1].id }}')
{%- endmacro %}

{# Danh sách mã tầm giá hợp lệ, dạng 'lt5','5to15',... để dùng trong IN (...) #}
{% macro price_band_ids() -%}
    {%- for b in var('price_bands') -%}'{{ b.id }}'{%- if not loop.last -%},{%- endif -%}{%- endfor -%}
{%- endmacro %}
