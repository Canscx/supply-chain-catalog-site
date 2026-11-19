<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Shanghai');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

const CONSULT_MAX_BODY = 20480;
const CONSULT_ALLOWED_SOURCES = ['index.html', 'catalog.html', 'index', 'catalog'];
const CONSULT_CSV_HEADER = [
    '提交时间',
    '编号',
    '公司名称',
    '联系人',
    '联系电话',
    '供应链品类',
    '定制链条',
    '单月需求(万元/每月)',
    '目前发票额度',
    '来源页面',
    '通知状态',
];

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $error, array $fields = [], string $message = ''): void
{
    $payload = ['ok' => false, 'error' => $error];
    if ($fields !== []) {
        $payload['fields'] = $fields;
    }
    if ($message !== '') {
        $payload['message'] = $message;
    }
    respond($status, $payload);
}

function text_len(string $value): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($value, 'UTF-8');
    }
    return (int) preg_match_all('/./u', $value);
}

function text_cut(string $value, int $max): string
{
    if (text_len($value) <= $max) {
        return $value;
    }
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max, 'UTF-8');
    }
    $chars = preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
    return implode('', array_slice($chars ?: [], 0, $max));
}

function clean_text($value, int $max): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $text = (string) $value;
    $text = str_replace(["\r", "\n", "\0"], ' ', $text);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? $text;
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
    $text = trim($text);
    return text_cut($text, $max);
}

function load_config(): array
{
    $envConfig = getenv('CONSULT_CONFIG_FILE');
    $file = (is_string($envConfig) && $envConfig !== '') ? $envConfig : (__DIR__ . '/config.php');
    if (!is_file($file)) {
        fail(503, 'not_configured', [], '服务暂时不可用，请稍后再试');
    }
    $config = require $file;
    if (!is_array($config)) {
        fail(503, 'not_configured', [], '服务暂时不可用，请稍后再试');
    }
    $envWebhook = getenv('CONSULT_WECOM_WEBHOOK');
    if (is_string($envWebhook) && $envWebhook !== '') {
        $config['wecom_webhook'] = $envWebhook;
    }
    $envDataDir = getenv('CONSULT_DATA_DIR');
    if (is_string($envDataDir) && $envDataDir !== '') {
        $config['data_dir'] = $envDataDir;
    }
    return $config;
}

function ensure_data_dir(array $config): string
{
    $dir = (string) ($config['data_dir'] ?? (dirname(__DIR__, 2) . '/consult-data'));
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    if (!is_dir($dir) || !is_writable($dir)) {
        fail(500, 'storage_unavailable', [], '提交失败，请稍后重试');
    }
    return rtrim($dir, DIRECTORY_SEPARATOR);
}

function client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function rate_limit(string $dir, array $config): void
{
    $limits = is_array($config['rate_limit'] ?? null) ? $config['rate_limit'] : [];
    $window = max(60, (int) ($limits['window_seconds'] ?? 600));
    $maxWindow = max(1, (int) ($limits['max_per_window'] ?? 10));
    $maxDay = max(1, (int) ($limits['max_per_day'] ?? 50));
    $ip = client_ip();
    $file = $dir . '/rate.json';
    $fp = @fopen($file, 'c+');
    if (!$fp) {
        return;
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return;
    }
    $raw = stream_get_contents($fp);
    $all = json_decode($raw ?: '{}', true);
    if (!is_array($all)) {
        $all = [];
    }
    $now = time();
    $today = date('Y-m-d');
    $entry = $all[$ip] ?? ['window_start' => $now, 'window_count' => 0, 'day' => $today, 'day_count' => 0];
    if (($now - (int) ($entry['window_start'] ?? 0)) >= $window) {
        $entry['window_start'] = $now;
        $entry['window_count'] = 0;
    }
    if (($entry['day'] ?? '') !== $today) {
        $entry['day'] = $today;
        $entry['day_count'] = 0;
    }
    if ((int) ($entry['window_count'] ?? 0) >= $maxWindow || (int) ($entry['day_count'] ?? 0) >= $maxDay) {
        flock($fp, LOCK_UN);
        fclose($fp);
        fail(429, 'rate_limited', [], '提交太频繁，请稍后再试');
    }
    foreach ($all as $key => $value) {
        if ($now - (int) ($value['window_start'] ?? 0) > 172800) {
            unset($all[$key]);
        }
    }
    $entry['window_count'] = (int) ($entry['window_count'] ?? 0) + 1;
    $entry['day_count'] = (int) ($entry['day_count'] ?? 0) + 1;
    $all[$ip] = $entry;
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($all, JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    @chmod($file, 0640);
}

function csv_cell(string $value): string
{
    $value = str_replace(["\r", "\n"], ' ', $value);
    if ($value !== '' && preg_match('/^[=+\-@]/', $value)) {
        $value = "'" . $value;
    }
    return $value;
}

function append_csv(string $dir, array $row): string
{
    $file = $dir . '/consultations.csv';
    $fp = @fopen($file, 'ab');
    if (!$fp) {
        fail(500, 'storage_unavailable', [], '提交失败，请稍后重试');
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        fail(500, 'storage_unavailable', [], '提交失败，请稍后重试');
    }
    $stat = fstat($fp);
    $isNew = (int) ($stat['size'] ?? 0) === 0;
    if ($isNew) {
        fwrite($fp, "\xEF\xBB\xBF");
        fputcsv($fp, CONSULT_CSV_HEADER, ',', '"', '');
    }
    fputcsv($fp, array_map('csv_cell', $row), ',', '"', '');
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    @chmod($file, 0640);
    return $file;
}

function update_csv_status(string $file, string $id, string $status): void
{
    $fp = @fopen($file, 'r+b');
    if (!$fp) {
        return;
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return;
    }
    $content = stream_get_contents($fp);
    $bom = "\xEF\xBB\xBF";
    if (strncmp($content, $bom, 3) === 0) {
        $content = substr($content, 3);
    }
    $rows = [];
    $stream = fopen('php://temp', 'r+');
    fwrite($stream, $content);
    rewind($stream);
    while (($row = fgetcsv($stream, 0, ',', '"', '')) !== false) {
        $rows[] = $row;
    }
    fclose($stream);
    $changed = false;
    foreach ($rows as &$row) {
        if (($row[1] ?? '') === $id) {
            $row[10] = $status;
            $changed = true;
            break;
        }
    }
    unset($row);
    if (!$changed) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return;
    }
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, $bom);
    foreach ($rows as $row) {
        fputcsv($fp, $row, ',', '"', '');
    }
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}

function http_post_json(string $url, string $payload): array
{
    $caFile = __DIR__ . '/cacert.pem';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 6,
        ]);
        if (is_file($caFile)) {
            curl_setopt($ch, CURLOPT_CAINFO, $caFile);
        }
        $response = curl_exec($ch);
        $error = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $data = json_decode(is_string($response) ? $response : '', true);
        return [
            'ok' => $status >= 200 && $status < 300 && is_array($data) && (int) ($data['errcode'] ?? -1) === 0,
            'status' => $status,
            'errcode' => is_array($data) ? ($data['errcode'] ?? null) : null,
            'errmsg' => is_array($data) ? (string) ($data['errmsg'] ?? '') : ($error ?: ''),
        ];
    }

    $ssl = ['verify_peer' => true, 'verify_peer_name' => true];
    if (is_file($caFile)) {
        $ssl['cafile'] = $caFile;
    }
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\nAccept: application/json\r\n",
            'content' => $payload,
            'timeout' => 6,
            'ignore_errors' => true,
        ],
        'ssl' => $ssl,
    ]);
    $response = @file_get_contents($url, false, $context);
    $status = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int) $m[1];
    }
    $data = json_decode(is_string($response) ? $response : '', true);
    return [
        'ok' => $status >= 200 && $status < 300 && is_array($data) && (int) ($data['errcode'] ?? -1) === 0,
        'status' => $status,
        'errcode' => is_array($data) ? ($data['errcode'] ?? null) : null,
        'errmsg' => is_array($data) ? (string) ($data['errmsg'] ?? '') : ($response ?: ''),
    ];
}

function markdown_escape(string $value): string
{
    return str_replace(
        ['\\', '*', '_', '[', ']', '`', '#', '>'],
        ['\\\\', '\\*', '\\_', '\\[', '\\]', '\\`', '\\#', '\\>'],
        $value
    );
}

function send_wecom(string $url, string $content): array
{
    $payload = json_encode(['msgtype' => 'markdown', 'markdown' => ['content' => $content]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $last = ['ok' => false, 'errcode' => -1, 'errmsg' => 'request_failed'];
    for ($i = 0; $i < 2; $i++) {
        $last = http_post_json($url, $payload);
        if ($last['ok']) {
            return $last;
        }
        if ($i === 0) {
            usleep(300000);
        }
    }
    return $last;
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        fail(405, 'method_not_allowed');
    }

    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    $hostName = preg_replace('/:\d+$/', '', $host) ?: $host;
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    $referer = (string) ($_SERVER['HTTP_REFERER'] ?? '');
    $checkUrl = $origin !== '' ? $origin : $referer;
    if ($checkUrl !== '') {
        $checkHost = parse_url($checkUrl, PHP_URL_HOST);
        if (is_string($checkHost) && $checkHost !== '' && strcasecmp($checkHost, $hostName) !== 0) {
            fail(403, 'forbidden_origin');
        }
    }

    $contentType = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
    if (stripos($contentType, 'application/json') !== 0) {
        fail(415, 'unsupported_media_type');
    }

    $raw = file_get_contents('php://input');
    if (!is_string($raw)) {
        fail(400, 'invalid_request');
    }
    if (strlen($raw) > CONSULT_MAX_BODY) {
        fail(413, 'payload_too_large');
    }
    $input = json_decode($raw, true);
    if (!is_array($input)) {
        fail(400, 'invalid_json');
    }

    $config = load_config();
    $dataDir = ensure_data_dir($config);
    rate_limit($dataDir, $config);

    if (trim((string) ($input['website'] ?? '')) !== '') {
        respond(200, ['ok' => true, 'id' => 'ignored', 'notified' => false]);
    }

    $fields = [];
    $company = clean_text($input['company'] ?? '', 60);
    $contact = clean_text($input['contact'] ?? '', 20);
    $phoneRaw = clean_text($input['phone'] ?? '', 20);
    $phone = preg_replace('/[\s-]+/', '', $phoneRaw) ?? '';
    $categories = clean_text($input['categories'] ?? '', 100);
    $custom = clean_text($input['custom_chain'] ?? '', 300);
    $demand = clean_text($input['demand'] ?? '', 12);
    $invoice = clean_text($input['invoice'] ?? '', 60);
    $agree = $input['agree'] ?? false;
    $customRequested = !empty($input['custom_requested']);
    $source = clean_text($input['source'] ?? 'index.html', 40);
    if (!in_array($source, CONSULT_ALLOWED_SOURCES, true)) {
        $source = 'index.html';
    }

    if (text_len($company) < 2) {
        $fields['company'] = '请填写公司名字（2–60 字）';
    }
    if ($contact === '') {
        $fields['contact'] = '请填写联系人';
    }
    if (!preg_match('/^1[3-9]\d{9}$/', $phone)) {
        $fields['phone'] = '请输入正确的 11 位手机号码';
    }
    if ($categories === '' && $custom === '') {
        $fields['categories'] = '请选择或填写供应链品类';
    }
    if ($customRequested && $custom === '') {
        $fields['custom_chain'] = '请描述你想要的链条';
    }
    if (!preg_match('/^\d+(\.\d{1,2})?$/', $demand) || (float) $demand <= 0) {
        $fields['demand'] = '请填写大于 0 的数字金额';
    }
    if ($invoice === '') {
        $fields['invoice'] = '请填写目前发票额度';
    }
    if (!($agree === true || $agree === 'true' || $agree === 1 || $agree === '1')) {
        $fields['agree'] = '请先勾选同意声明';
    }

    if ($fields !== []) {
        fail(422, 'validation', $fields);
    }

    $id = date('Ymd-His') . '-' . bin2hex(random_bytes(3));
    $now = date('Y-m-d H:i:s');
    $row = [
        $now,
        $id,
        $company,
        $contact,
        $phone,
        $categories,
        $custom,
        $demand,
        $invoice,
        $source,
        '待发送',
    ];
    $csvFile = append_csv($dataDir, $row);

    $notifyStatus = '未配置';
    $notified = false;
    $webhook = trim((string) ($config['wecom_webhook'] ?? ''));
    if ($webhook !== '') {
        $lines = [
            '**【官网合作咨询】**',
            '**编号：** ' . markdown_escape($id),
            '**公司：** ' . markdown_escape($company),
            '**联系人：** ' . markdown_escape($contact),
            '**电话：** ' . markdown_escape($phone),
            '**品类：** ' . markdown_escape($categories !== '' ? $categories : '我要定制'),
        ];
        if ($custom !== '') {
            $lines[] = '**定制链条：** ' . markdown_escape($custom);
        }
        $lines[] = '**单月需求：** ' . markdown_escape($demand) . ' 万元/月';
        $lines[] = '**发票额度：** ' . markdown_escape($invoice);
        $lines[] = '**时间：** ' . markdown_escape($now);
        $result = send_wecom($webhook, implode("\n", $lines));
        if ($result['ok']) {
            $notifyStatus = '已发送';
            $notified = true;
        } else {
            $notifyStatus = '发送失败';
            @file_put_contents(
                $dataDir . '/webhook-error.log',
                $now . ' errcode=' . (string) ($result['errcode'] ?? '') . ' errmsg=' . (string) ($result['errmsg'] ?? '') . "\n",
                FILE_APPEND | LOCK_EX
            );
        }
    }
    update_csv_status($csvFile, $id, $notifyStatus);

    respond(200, ['ok' => true, 'id' => $id, 'notified' => $notified]);
} catch (Throwable $e) {
    $logDir = isset($dataDir) ? $dataDir : (dirname(__DIR__, 2) . '/consult-data');
    @file_put_contents($logDir . '/php-error.log', date('c') . ' ' . $e->getMessage() . "\n", FILE_APPEND | LOCK_EX);
    fail(500, 'server_error', [], '提交失败，请稍后重试');
}
