<?php
declare(strict_types=1);

$envConfig = getenv('CONSULT_CONFIG_FILE');
$configFile = (is_string($envConfig) && $envConfig !== '') ? $envConfig : (__DIR__ . '/config.php');
if (!is_file($configFile)) {
    http_response_code(404);
    exit;
}
$config = require $configFile;
if (!is_array($config)) {
    http_response_code(404);
    exit;
}

$token = (string) ($config['admin_token'] ?? '');
$given = (string) ($_GET['token'] ?? '');
if ($token === '' || !hash_equals($token, $given)) {
    http_response_code(404);
    exit;
}

$dir = (string) ($config['data_dir'] ?? (dirname(__DIR__, 2) . '/consult-data'));
$envDataDir = getenv('CONSULT_DATA_DIR');
if (is_string($envDataDir) && $envDataDir !== '') {
    $dir = $envDataDir;
}
$file = rtrim($dir, DIRECTORY_SEPARATOR) . '/consultations.csv';
if (!is_file($file)) {
    http_response_code(404);
    exit;
}

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="consultations-' . date('Ymd-His') . '.csv"');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
readfile($file);
exit;
