{{ config(materialized='view') }}
-- =====================================================================
-- stg_outputvoucher_detail — GRAIN: 1 dòng / chi tiết phiếu xuất.
-- Chỉ DEDUP + gộp header vào detail, GIỮ NGUYÊN id (chưa enrich chiều).
-- Dedup: raw *_local (ReplacingMergeTree) có thể chứa nhiều version -> lấy bản
-- updated_at mới nhất bằng "LIMIT 1 BY <khóa>".
-- =====================================================================
with detail as (
    -- dedup theo meta của source (cdc_timestamp + cdc_version)
    {{ dedup_source('raw', 'pm_outputvoucherdetail') }}
),
header as (
    -- dedup theo meta của source (inputtime)
    {{ dedup_source('raw', 'pm_outputvoucher') }}
)
select
    -- khóa + FK
    d.outputvoucherdetailid,
    d.outputvoucherid,
    d.productid,
    d.outputtypeid,
    d.saleorderdetailid,
    d.inventorystatusid,
    d.buyinputvoucherid,
    h.storeid,
    h.orderid,
    h.currencyunitid,
    h.customerid,
    h.payabletypeid,
    -- đo lường
    d.quantity,
    d.costprice,
    d.saleprice,
    d.retailprice,
    d.vat,
    d.vatpercent,
    d.imei,
    -- thuộc tính header giữ nguyên (không có trong chiều)
    h.customername,
    h.customeraddress,
    h.taxid,
    h.staffuser,
    h.outputcontent,
    h.invoiceid,
    h.invoicesymbol,
    h.invoicedate,
    h.outputdate,
    d.inputtime,
    d.cdc_timestamp          -- = now() mỗi lần insert/update -> watermark incremental của fct
from detail d
inner join header h on h.outputvoucherid = d.outputvoucherid
-- Không lọc ngày ở đây: khoảng thời gian do incremental ở fct (theo inputtime) lo.
