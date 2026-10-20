#!/usr/bin/env bash
#
# scripts/deploy-production.sh
#
# 役割:
#   Mac側から本番VPS（senjutsu-app）へ seishi-app をデプロイする。
#   個別ファイルを手作業で選んでrsyncする方式（転送漏れの原因になっていた）
#   をやめ、アプリを構成する必要なソース一式をまとめて同期する。
#
# 使い方:
#   bash scripts/deploy-production.sh
#   （リポジトリ直下・他のディレクトリどちらから実行してもよい。
#     スクリプト自身の場所からリポジトリルートを自動判定する）
#
# 安全設計（最重要）:
#   ・npm run build が失敗した場合、PM2には一切触れない
#     （restart/stopしない。現在稼働中の本番アプリをそのまま維持する）。
#     これは「先にPM2を止める→build失敗→502」を避けるための設計であり、
#     本スクリプトでは常に「rsync→npm ci→npm run build→(成功時のみ)
#     pm2 restart」の順で実行し、途中のどの段階が失敗しても
#     `set -euo pipefail` によりその場で処理を打ち切る
#     （＝失敗した時点より後のコマンド、特に pm2 restart は実行されない）。
#   ・rsync に --delete は使わない（本番固有ファイルの誤削除を防ぐ）。
#   ・.env* ・認証DB（/home/ubuntu/seishi-app-data/）・.next/・node_modules/・
#     .git/・docs/source/ 等の資料類・テスト用資料は、そもそも転送対象の
#     ソースリストに含めていない（除外パターンに頼るのではなく、
#     「本番へ送るものだけを明示的に指定する」方式にしている）。
#   ・秘密情報（.envの中身、SSH鍵の中身等）は標準出力に表示しない。
#     rsyncの-vは転送されたファイル名（パス）だけを表示する。
#
# 転送対象（最低限、ユーザー指示どおり）:
#   src/ public/ package.json package-lock.json next.config.ts
#   tsconfig.json postcss.config.mjs eslint.config.mjs
#   （scripts/ 自体も本番運用に使える可能性があるため合わせて転送する）
#
# 絶対に転送・上書き・削除しないもの:
#   .env / .env.local / .env.production / .env.production.local / .env.*.local
#   secrets・認証DB・/home/ubuntu/seishi-app-data/
#   .next/ ・ node_modules/ ・ .git/ ・ docs/source/ 等の資料類・テスト用資料
#   （これらはいずれも転送対象リストに含めていないため、rsyncの対象にすら
#     ならない。本番の ~/senjutsu-app/.env.production.local は
#     このスクリプトからは一切触れられない）。

set -euo pipefail

# ---------------------------------------------------------------------------
# 設定
# ---------------------------------------------------------------------------
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SSH_HOST="133.18.149.168"
SSH_USER="ubuntu"
SSH_KEY="${HOME}/.ssh/senjutsu-app-mac.key"
SSH_TARGET="${SSH_USER}@${SSH_HOST}"

# リモート側のアプリディレクトリ（$HOME/senjutsu-app）。~ 展開はリモート
# シェル側で行わせるため、ここでは "senjutsu-app" という相対名だけを持ち、
# 実際の参照はすべて `cd "$HOME/$REMOTE_APP_DIR"` のようにリモート側で組み立てる。
REMOTE_APP_DIR="senjutsu-app"
PM2_PROCESS="senjutsu-app"

# デプロイ後のヘルスチェック（VPS上のlocalhost:3000へ）。
HEALTH_CHECK_PATH="/lucky-day"
HEALTH_CHECK_RETRIES=8
HEALTH_CHECK_INTERVAL_SEC=3

# accept-new: 初回接続時のみホスト鍵を自動登録する（対話プロンプトで
# デプロイが止まらないようにするため）。改ざんされたホスト鍵は
# 従来どおり拒否される（acceptedを変更する動作ではない）。
SSH_OPTS=(-i "${SSH_KEY}" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)

cd "${REPO_DIR}"

log() { printf '\n[deploy] %s\n' "$1"; }
abort() { printf '\n[deploy][ABORT] %s\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 0. 前提チェック
# ---------------------------------------------------------------------------
[ -f "${SSH_KEY}" ] || abort "SSH鍵が見つかりません: ${SSH_KEY}"
command -v rsync >/dev/null 2>&1 || abort "rsync コマンドが見つかりません。"
command -v ssh >/dev/null 2>&1 || abort "ssh コマンドが見つかりません。"
command -v npx >/dev/null 2>&1 || abort "npx コマンドが見つかりません（Node.jsが必要です）。"

log "[0/8] リポジトリ: ${REPO_DIR}"
log "[0/8] デプロイ先: ${SSH_TARGET}:~/${REMOTE_APP_DIR} (PM2: ${PM2_PROCESS})"

log "[0/8] VPS側の本番ディレクトリ・.env.production.local の存在を確認します（内容は読みません）"
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" \
  "test -d \"\$HOME/${REMOTE_APP_DIR}\" && test -f \"\$HOME/${REMOTE_APP_DIR}/.env.production.local\"" \
  || abort "リモートに ~/${REMOTE_APP_DIR}/.env.production.local が見つかりません。デプロイ先の構成を確認してください。"

# ---------------------------------------------------------------------------
# 1. ローカル事前チェック（1つでも失敗したら転送自体を中止する）
# ---------------------------------------------------------------------------
log "[1/8] TypeScript チェック (npx tsc --noEmit)"
npx tsc --noEmit || abort "tsc --noEmit が失敗しました。転送を中止します。"

run_test_if_present() {
  local test_path="$1"
  shift
  if [ -f "${test_path}" ]; then
    log "[1/8] ${test_path} を実行します"
    npx tsx "$@" "${test_path}" || abort "${test_path} が失敗しました。転送を中止します。"
  else
    log "[1/8] ${test_path} が見つからないためスキップします。"
  fi
}

run_test_if_present "tests/lucky_day_access_control.manual.ts"
run_test_if_present "tests/lucky_day_member_auth.manual.ts" --conditions=react-server
run_test_if_present "tests/lucky_day_hourly_fortune.manual.ts" --conditions=react-server
run_test_if_present "tests/lucky_day_course_invitation.manual.ts"

log "[1/8] ローカル事前チェック OK"

# ---------------------------------------------------------------------------
# 2. VPSへ必要なソース一式をrsync
#    --delete は使わない（本番固有ファイルを誤って消さないため）。
#    転送対象はここに明示したものだけ（.env*・認証DB・.next/・
#    node_modules/・.git/・docs/等はそもそもリストに含まれていない）。
# ---------------------------------------------------------------------------
log "[2/8] ソースを転送します（--delete なし）"

RSYNC_OPTS=(-az -v --human-readable --exclude=".DS_Store")
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

sync_dir() {
  local local_dir="$1"
  local remote_subdir="$2"
  if [ -d "${local_dir}" ]; then
    rsync "${RSYNC_OPTS[@]}" -e "${RSYNC_SSH}" \
      "${local_dir}/" "${SSH_TARGET}:${REMOTE_APP_DIR}/${remote_subdir}/"
  else
    abort "必須ディレクトリが見つかりません: ${local_dir}"
  fi
}

sync_dir "src" "src"
sync_dir "public" "public"
# 初回転送で親ディレクトリ（docs/）が無くても rsync が通るよう、先に作成する（既存なら何もしない）。
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" "mkdir -p \"\$HOME/${REMOTE_APP_DIR}/docs/qizheng-data\""
sync_dir "docs/qizheng-data" "docs/qizheng-data"

# scripts/ 自体も転送する（本番側での運用に使える構成にしておく）。
if [ -d "scripts" ]; then
  rsync "${RSYNC_OPTS[@]}" -e "${RSYNC_SSH}" \
    "scripts/" "${SSH_TARGET}:${REMOTE_APP_DIR}/scripts/"
fi

CONFIG_FILES=(
  package.json
  package-lock.json
  next.config.ts
  tsconfig.json
  postcss.config.mjs
  eslint.config.mjs
)
EXISTING_CONFIG_FILES=()
for f in "${CONFIG_FILES[@]}"; do
  if [ -f "${f}" ]; then
    EXISTING_CONFIG_FILES+=("${f}")
  else
    log "[2/8] 警告: ${f} が見つからないためスキップします（ファイル名が変わっていないか確認してください）"
  fi
done

if [ "${#EXISTING_CONFIG_FILES[@]}" -eq 0 ]; then
  abort "転送対象の設定ファイルが1つも見つかりませんでした。"
fi

rsync "${RSYNC_OPTS[@]}" -e "${RSYNC_SSH}" \
  "${EXISTING_CONFIG_FILES[@]}" "${SSH_TARGET}:${REMOTE_APP_DIR}/"

log "[2/8] 転送完了"

# ---------------------------------------------------------------------------
# 3〜7. リモート側: 依存関係反映 → build → (成功時のみ) PM2再起動 → 確認
#    ここはすべて1つのSSHセッション内で実行し、`set -euo pipefail` により
#    npm run build が失敗した時点でそのまま終了する
#    （pm2 restart には絶対に到達しない）。
# ---------------------------------------------------------------------------
log "[3-7/8] リモートで依存関係反映・ビルド・(成功時のみ)PM2再起動を実行します"

set +e
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" bash -s -- \
  "${REMOTE_APP_DIR}" "${PM2_PROCESS}" "${HEALTH_CHECK_PATH}" "${HEALTH_CHECK_RETRIES}" "${HEALTH_CHECK_INTERVAL_SEC}" \
  <<'REMOTE_SCRIPT'
set -euo pipefail

REMOTE_APP_DIR="$1"
PM2_PROCESS="$2"
HEALTH_CHECK_PATH="$3"
HEALTH_CHECK_RETRIES="$4"
HEALTH_CHECK_INTERVAL_SEC="$5"

cd "${HOME}/${REMOTE_APP_DIR}"
echo "[remote] cd $(pwd)"

echo "[remote 3/8] npm ci (package-lock.json に厳密に従って依存関係を反映)"
npm ci

echo "[remote 4/8] npm run build"
npm run build

echo "[remote] build成功。ここから先だけPM2へ触れます。"

echo "[remote 5/8] pm2 restart ${PM2_PROCESS}"
pm2 restart "${PM2_PROCESS}"

echo "[remote 6/8] pm2 status"
pm2 list

PM2_ONLINE="$(
  pm2 jlist | node -e '
    const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const name = process.argv[1];
    const proc = data.find((p) => p.name === name);
    if (proc && proc.pm2_env && proc.pm2_env.status === "online") {
      process.stdout.write("1");
    } else {
      process.stdout.write("0");
    }
  ' "${PM2_PROCESS}"
)"

if [ "${PM2_ONLINE}" != "1" ]; then
  echo "[remote][ABORT] PM2プロセス ${PM2_PROCESS} が online 状態ではありません。" >&2
  exit 1
fi

echo "[remote 7/8] ヘルスチェック: http://localhost:3000${HEALTH_CHECK_PATH}"
OK=0
for i in $(seq 1 "${HEALTH_CHECK_RETRIES}"); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000${HEALTH_CHECK_PATH}" || echo "000")"
  echo "  試行 ${i}/${HEALTH_CHECK_RETRIES}: HTTP ${CODE}"
  if [ "${CODE}" -ge 200 ] 2>/dev/null && [ "${CODE}" -lt 300 ] 2>/dev/null; then
    OK=1
    break
  fi
  sleep "${HEALTH_CHECK_INTERVAL_SEC}"
done

if [ "${OK}" -ne 1 ]; then
  echo "[remote][ABORT] ヘルスチェックに失敗しました（200系が返りませんでした）。" >&2
  exit 1
fi

echo "[remote 8/8] リモート側の処理はすべて成功しました。"
REMOTE_SCRIPT
REMOTE_EXIT_CODE=$?
set -e

if [ "${REMOTE_EXIT_CODE}" -ne 0 ]; then
  abort "リモート側の処理が失敗しました（exit=${REMOTE_EXIT_CODE}）。npm run build より前の失敗であればPM2は無変更、npm run build 自体の失敗であればPM2には一切触れていません。ビルドが成功した後（pm2 restart以降）の失敗の場合のみ、本番は新バージョンで再起動済みです。VPS上のログを確認してください。"
fi

log "[8/8] デプロイ成功: ${SSH_TARGET} の PM2プロセス「${PM2_PROCESS}」がビルド後に再起動され、ヘルスチェック（${HEALTH_CHECK_PATH}）にも成功しました。"
