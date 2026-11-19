<?php
/**
 * 复制为 config.php 后填写；config.php 已被 .gitignore 忽略。
 * 不要把真实 Webhook 写进本文件，也不要提交到 git。
 */
return [
    'wecom_webhook' => '',
    'admin_token' => '',
    'data_dir' => dirname(__DIR__, 2) . '/consult-data',
    'rate_limit' => [
        'window_seconds' => 600,
        'max_per_window' => 10,
        'max_per_day' => 50,
    ],
];
