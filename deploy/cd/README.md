# CI/CD cho Getshopy — GitHub Actions + webhook qua Tailscale Funnel

| Thành phần | Vai trò |
|---|---|
| `.github/workflows/ci.yml` | Kiểm thử mỗi PR / push vào `build_prod`, `main`. **Chỉ kiểm thử** — không build image, không deploy. |
| `.github/workflows/rebuild-deploy.yml` | Comment `/rebuild` trên PR đã merge vào `build_prod`, hoặc bấm tay → build image → deploy → trả lời trên PR. |
| `.github/workflows/images.yml` | (tái sử dụng) build + đẩy 4 image `client`, `server`, `ai-bot`, `ai-rec` lên GHCR. |
| `.github/workflows/deploy.yml` | (tái sử dụng) gửi yêu cầu ký HMAC tới máy production, chờ kết quả + health check. |
| `deploy/cd/webhook-listener.ps1` | Trên máy production: nhận yêu cầu, kiểm chữ ký, xếp hàng, gọi bộ thực thi. |
| `deploy/cd/pull-deploy.ps1` | Trên máy production: kéo image, `docker compose up`, health check, rollback, dọn image. |
| `deploy/cd/register-task.ps1` | Đăng ký listener chạy nền khi đăng nhập (Task Scheduler). |

Image: `ghcr.io/levantrieuan/ktln-getshopy-<service>:sha-<40 ký tự commit>` (+ tag trôi `build_prod`).
Hạ tầng (postgres, clickhouse, kafka, minio, gateway...) **không** nằm trong CD — vẫn làm tay.

## Luồng

```mermaid
sequenceDiagram
    autonumber
    actor Dev
    participant GH as GitHub (PR, Actions)
    participant GHCR as GHCR
    participant TS as Tailscale Funnel<br/>https://&lt;máy&gt;.ts.net/hooks
    participant L as webhook-listener.ps1<br/>127.0.0.1:18095
    participant D as pull-deploy.ps1 + Docker Compose

    Dev->>GH: PR vào build_prod
    GH->>GH: CI (test, vite build) — chỉ kiểm thử
    Dev->>GH: merge PR (CI chạy lại trên build_prod, không deploy)
    Dev->>GH: comment "/rebuild" trên PR đã merge
    GH->>GH: guard: quyền write/admin, base = build_prod, đã merge, đọc HEAD build_prod
    GH-->>Dev: reaction 👀
    GH->>GHCR: build lại từ đầu HEAD build_prod, đẩy :sha-<HEAD>
    GH->>TS: POST /hooks/deploy (HMAC-SHA256, timestamp, nonce)
    TS->>L: chuyển tiếp (chỉ path /hooks)
    L-->>GH: 202 + id job
    L->>D: chạy pull-deploy.ps1 -Tag sha-<HEAD>
    D->>GHCR: docker pull 4 image
    D->>D: git merge --ff-only, compose up (server, ai-bot, ai-rec → client)
    D->>D: health: /api/health và / qua gateway (127.0.0.1:18000)
    alt health không đạt
        D->>D: rollback: image :rollback + git reset --keep
    end
    GH->>TS: GET /hooks/deploy/status/<id> (lặp tới khi xong)
    GH-->>Dev: comment ✅/❌ + tag + sha + link + kết quả health
```

## Cách dùng

**1. Merge vào `build_prod`** → chỉ chạy CI (tab *Actions* → *CI*). Production **chưa** đổi.

**2. Deploy: comment trên PR đã merge vào `build_prod`**, cả comment chỉ gồm một lệnh:

```
/rebuild
```

(hoặc `rebuild`, không phân biệt hoa thường; `/deploy` là tên khác). "rebuild" nằm trong một câu dài
hơn **không** kích hoạt. Người comment cần quyền **write/admin** trên repo. Workflow build lại
**từ đầu** commit HEAD *hiện tại* của `build_prod` (không phải code của PR), deploy, rồi trả lời trên
PR: ✅/❌, tag image, sha `build_prod`, link lần chạy, kết quả health check.
- PR chưa merge → trả lời "PR chưa merge vào build_prod — merge trước rồi comment rebuild".
- PR vào nhánh khác → trả lời rằng rebuild chỉ áp dụng cho PR vào `build_prod`.

**3. Deploy lại / quay về bằng tay**: *Actions* → *Rebuild & Deploy* → *Run workflow*:

| tag | rebuild | Kết quả |
|---|---|---|
| trống | bỏ chọn | deploy image `sha-<HEAD build_prod>` đã có trên GHCR |
| `sha-<40 ký tự>` | bỏ chọn | deploy đúng bản đó — **rollback** về commit cũ (chỉ đổi image, checkout giữ nguyên) |
| (bỏ qua) | chọn | build lại HEAD `build_prod` rồi deploy |

Danh sách tag có sẵn: trang *Packages* của repo, hoặc cột "Image" trong các comment ✅ trước đó.

**4. Xem log**
- GitHub: tab *Actions* → lần chạy *Rebuild & Deploy* (tóm tắt deploy nằm ở *Summary*); trang
  *Deployments* (environment `production`).
- Máy production: `%LOCALAPPDATA%\getshopy-cd\deploy.log` (bộ thực thi),
  `listener.log` (yêu cầu nhận/từ chối), `state.json` (bản đang chạy / bản trước), `jobs\<id>.json`.

```powershell
Get-Content "$env:LOCALAPPDATA\getshopy-cd\deploy.log" -Tail 50 -Encoding UTF8
```

## Vì sao webhook qua Funnel (không dùng self-hosted runner)

Máy production không có cổng nào mở; Internet chỉ tới được nó qua **Tailscale Funnel**. Self-hosted
runner trên repo **public** là rủi ro: GitHub khuyến cáo không dùng cho repo public vì PR từ fork có
thể chạy code tuỳ ý trên máy runner. Ở đây GitHub chỉ được phép làm **một việc** với máy: gửi
yêu cầu "deploy tag X" đã ký; máy tự kiểm rồi tự kéo image đã build trên GitHub. Máy không build
gì (ổ D: chật — một lần `docker build` tại máy từng làm đầy ổ, sập production 15/11).

| | Webhook (đang dùng) | Hỏi định kỳ (`-Poll`, dự phòng, TẮT) |
|---|---|---|
| Độ trễ từ lúc yêu cầu tới lúc bắt đầu deploy | `[đo]` | tới 1 chu kỳ (2 phút) + `[đo]` |
| Kết quả có báo ngược về GitHub/PR | có (job chờ status) | không |
| Cần đường vào từ Internet | có — chỉ path `/hooks` qua Funnel | không |
| Request GitHub API | 0 từ máy | ≤ 15 lượt/giờ khi chờ CI (hỏi tối đa ~4 phút/lần; giới hạn 60/giờ nếu không token) |
| Bề mặt tấn công | listener loopback + HMAC | không có đường vào |
| Chạy được khi Funnel tắt | không | có |

Bật dự phòng (thay listener): `.\deploy\cd\register-task.ps1 -Poll` — chỉ deploy commit `build_prod`
đã có image `sha-*` (tức là đã từng được `/rebuild`).

## Mô hình bảo mật

- **Chữ ký**: `X-Hub-Signature-256: sha256=HMAC-SHA256(secret, body thô)`, so sánh thời gian hằng.
  Secret ≥ 32 ký tự, nằm ở `%LOCALAPPDATA%\getshopy-cd\webhook.secret` (ngoài repo) và secret
  `DEPLOY_WEBHOOK_SECRET` của environment `production` trên GitHub.
- **Chống gửi lại**: body có `timestamp` (lệch tối đa ±5 phút) và `nonce` dùng một lần (lưu ra đĩa,
  còn hiệu lực qua khởi động lại listener).
- **Dữ liệu chặt**: body chỉ được có `kind, tag, sha, ref, timestamp, nonce`; `kind=build_prod`,
  `tag=^sha-[0-9a-f]{7,40}$` và phải bằng `sha-<sha>`, `ref=refs/heads/build_prod`. Listener không
  chạy gì lấy từ body — chỉ truyền tag/sha đã kiểm cho `pull-deploy.ps1`, script này kiểm lại lần
  nữa và chỉ deploy commit thuộc lịch sử `origin/build_prod`.
- **Trạng thái job**: `GET /hooks/deploy/status/<id>` với id 128 bit ngẫu nhiên, Actions che id trong
  log; nội dung chỉ là thông điệp ngắn do script soạn (không chép đầu ra lệnh, không có secret).
- **Đường vào**: listener chỉ nghe `127.0.0.1`; Funnel chỉ gắn path `/hooks`. Không container, không
  docker socket nào ra Internet; listener chạy bằng tài khoản người dùng (không admin).
- **Comment `/rebuild` — chặn "pwn request"**: `issue_comment` chạy với token ghi và đọc được secret,
  nên nếu build code của PR thì người lạ có thể chạy code với các quyền đó. Ở đây workflow **không
  bao giờ checkout code PR**: nó chỉ build commit đã nằm trên `build_prod` (đọc qua API, ghim sha).
  Thêm: chỉ comment trên PR; `author_association` OWNER/MEMBER/COLLABORATOR rồi hỏi API quyền thật
  phải là write/admin (lỗi = từ chối); PR phải vào `build_prod` và đã merge; nội dung comment chỉ
  được so khớp, không chèn vào shell. Secret deploy là secret của **environment**, chỉ job deploy
  (không checkout, chỉ curl) đọc được; job build chỉ có `GITHUB_TOKEN` với `packages: write`.
- CI cho PR dùng `pull_request` (không `pull_request_target`): PR từ fork chạy không secret, token chỉ đọc.

## Cài đặt một lần

**Trên GitHub** (repo *Settings*):

1. *Environments* → *New environment* `production`:
   - *Environment secrets*: `DEPLOY_WEBHOOK_SECRET` = giá trị tạo ở bước máy production (4).
   - *Deployment branches*: *Selected branches* → `main`, `build_prod`
     (comment `/rebuild` và *Run workflow* chạy trong ngữ cảnh `main`).
   - (tuỳ chọn) *Required reviewers* nếu muốn duyệt tay mỗi lần deploy.
2. *Secrets and variables* → *Actions* → *Variables*:

   | Tên | Giá trị | Ghi chú |
   |---|---|---|
   | `DEPLOY_HOOK_URL` | `https://msi.taild22ef7.ts.net/hooks` | bắt buộc |
   | `PRODUCTION_URL` | `https://msi.taild22ef7.ts.net` | link trong trang Deployments |
   | `VITE_GOOGLE_CLIENT_ID` | như `VITE_GOOGLE_CLIENT_ID` trong `.env` production | trống = ẩn nút Google |
   | `VITE_API_URL` | (để trống = `/api`) | tuỳ chọn |
   | `VITE_WS_URL` | (để trống = rỗng) | tuỳ chọn |

   Biến `VITE_*` bị nhúng vào JS gửi cho mọi trình duyệt — chỉ đặt giá trị công khai.
3. *Actions* → *General*: Actions bật. Workflow tự khai `permissions:` tối thiểu; không cần đổi
   *Workflow permissions*.
4. **Merge các workflow vào `main`**: `issue_comment` (comment `/rebuild`) và *Run workflow* chỉ chạy
   file workflow của nhánh mặc định (`main`). CI (`pull_request`/`push`) chạy được ngay trên `build_prod`.
5. Sau lần build đầu, 4 package `ktln-getshopy-*` xuất hiện ở trang của chủ repo (*Packages*). Máy
   production cần đọc được chúng — chọn **một**:
   - chủ repo đổi từng package sang **Public** (*Package settings* → *Change visibility*; repo đã
     public nên không lộ thêm gì), hoặc
   - trên máy production: `docker login ghcr.io -u <github-user>` với *classic PAT* chỉ quyền
     `read:packages`.

**Trên máy production** (PowerShell, tài khoản đang chạy Docker Desktop):

```powershell
# 1. Secret dùng chung (in ra để dán vào GitHub, rồi xoá khỏi clipboard/màn hình)
$dir = "$env:LOCALAPPDATA\getshopy-cd"; New-Item -ItemType Directory -Force $dir | Out-Null
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
$s = -join ($b | ForEach-Object { $_.ToString('x2') })
[IO.File]::WriteAllText("$dir\webhook.secret", $s); $s | Set-Clipboard   # dán vào DEPLOY_WEBHOOK_SECRET

# 2. Listener chạy nền khi đăng nhập (+ tự dựng lại mỗi 5 phút nếu chết), không cần admin
cd "C:\Users\AD\Desktop\TDTU 2023-2024\KLTN\ktln-Getshopy"
.\deploy\cd\register-task.ps1 -RunNow
Invoke-RestMethod http://127.0.0.1:18095/hooks/health        # {"ok":true,...}

# 3. Mở đúng path /hooks qua Funnel (cổng 443 đang phục vụ cửa hàng — path khác giữ nguyên)
tailscale funnel --bg --https=443 --set-path=/hooks http://127.0.0.1:18095/hooks
tailscale funnel status
curl.exe https://msi.taild22ef7.ts.net/hooks/health          # từ máy khác / điện thoại
```

Funnel bỏ tiền tố mount rồi nối phần còn lại vào URL đích (`/hooks/deploy` → `http://127.0.0.1:18095/hooks/deploy`)
và giữ nguyên header `Host`; listener dùng prefix IP `127.0.0.1` nên vẫn nhận (đã thử).
Gỡ: `tailscale funnel --https=443 --set-path=/hooks off`. Cổng 18095 chọn vì 9000 là cổng MinIO.

Gỡ listener: `.\deploy\cd\register-task.ps1 -Unregister`. Tạm dừng khi thao tác tay:
`Disable-ScheduledTask -TaskPath \Getshopy\ -TaskName Getshopy-CD-Listener` (bật lại: `Enable-...`).

## Lần deploy đầu và thao tác tay

- Lần đầu chưa có `state.json`: bản đang chạy (image `kltn-*:latest` build tại máy) được ghi nhớ
  thành tag `:rollback` trước khi deploy — lỗi thì quay về đúng nó.
- `docker-compose.yml` có `image: ghcr.io/levantrieuan/ktln-getshopy-<svc>:${IMAGE_TAG:-local}`
  (vẫn giữ `build:`). Sau mỗi lần deploy, tag `:local` trỏ vào bản đang chạy, nên `docker compose up -d`
  gõ tay **không** build lại; `docker compose up -d --build` vẫn build tại máy như trước (ổ D: ≥ 20 GB!).
  Muốn dùng đúng tag đang chạy:
  ```powershell
  $env:IMAGE_TAG = (Get-Content "$env:LOCALAPPDATA\getshopy-cd\state.json" | ConvertFrom-Json).deployed_tag
  ```
- Image cũ `kltn-client/server/ai-bot/ai-rec:latest` không bị xoá tự động; xoá tay khi bản CD đã ổn
  (giải phóng `[đo]` GB).
- Deploy/rollback trực tiếp trên máy (không qua GitHub):
  ```powershell
  .\deploy\cd\pull-deploy.ps1 -Tag sha-<40 ký tự>      # deploy / quay về một commit build_prod
  .\deploy\cd\pull-deploy.ps1 -Rollback                 # quay về bản trước trong state.json
  .\deploy\cd\pull-deploy.ps1 -Tag sha-<...> -DryRun    # chỉ in kế hoạch, không đổi gì
  ```

## Rào chắn của mỗi lần deploy

Ổ `D:` còn ≥ 20 GB · đủ 4 image trên GHCR · commit thuộc `origin/build_prod` · working tree sạch ·
chỉ `git merge --ff-only` (không bao giờ `reset --hard`, không đụng `.env`) · kéo image **trước** khi
đổi gì · `--no-deps` (không tạo lại postgres/clickhouse/redis) · `server` lên và healthy trước rồi mới
tới `client` · health `/api/health` và `/` qua gateway trong 120 s · lỗi → rollback image `:rollback` +
`git reset --keep` (từ chối thay vì ghi đè thay đổi cục bộ) · xong → giữ tag hiện tại + tag trước.

Thay đổi ở `docker-compose.yml` của 4 service ứng dụng được áp tự động. Thay đổi hạ tầng (gateway,
service khác trong compose, `local-infra-sandbox/`, `scripts/`, `.env.example`...) chỉ được **ghi cảnh
báo** trong `deploy.log` kèm lệnh cần chạy tay.

## Sự cố

| Triệu chứng | Xử lý |
|---|---|
| Actions: "Không gọi được máy production" | máy tắt / Docker Desktop tắt / listener chết (`Get-ScheduledTask -TaskPath \Getshopy\`) / Funnel tắt (`tailscale funnel status`) |
| HTTP 401 "chữ ký không khớp" | secret trên GitHub khác `webhook.secret` |
| HTTP 401 "timestamp lệch" | đồng hồ máy production sai — đồng bộ giờ Windows |
| job `rejected`: thiếu image | package private chưa `docker login ghcr.io` (Cài đặt 5), hoặc tag chưa từng build (chạy với rebuild) |
| job `rejected`: working tree có thay đổi | `git status` trên máy production, commit/stash bằng tay |
| job `rolled_back` | bản mới không healthy; production đang chạy lại bản trước — xem `deploy.log` |
| job `rollback_failed` | kiểm tra tay: `docker compose ps`, `git status`; quay về bằng `pull-deploy.ps1 -Rollback` hoặc `-Tag <tag cũ>` |

## Giới hạn

- Một máy, Docker Compose: mỗi lần deploy **tạo lại** 4 container → gián đoạn ngắn `[đo]` giây (gateway
  trả trang bảo trì 503). Kubernetes làm được rolling update không gián đoạn — xem `deploy/k8s-demo/`.
- Mỗi lần deploy khởi động lại cả 4 service kể cả service không đổi (tag theo commit).
- Rollback chỉ quay **image và checkout**; migration Prisma mà server đã áp **không** được hoàn tác.
- Hạ tầng (gateway, DB, Kafka, MinIO, ClickHouse...) vẫn deploy tay.
- Funnel/listener/Docker Desktop tắt hoặc máy ngủ → không deploy được (Actions báo lỗi, không treo).
- Chỉ chạy khi người dùng đã đăng nhập Windows (Docker Desktop cũng vậy).

## Nguồn

- Self-hosted runner và repo public: https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners#self-hosted-runner-security
- "Pwn request" (`pull_request_target`/`issue_comment` chạy code PR): https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/
- Workflow `issue_comment`/`workflow_dispatch` dùng file của nhánh mặc định: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows
- Secret của environment trong reusable workflow: https://docs.github.com/en/actions/sharing-automations/reusing-workflows
- Chữ ký webhook kiểu `X-Hub-Signature-256`: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
- Tailscale Funnel (`--set-path`, `off`, `status`): https://tailscale.com/kb/1311/tailscale-funnel ; xử lý path/Host khi proxy: `ipn/ipnlocal/serve.go` trong https://github.com/tailscale/tailscale
