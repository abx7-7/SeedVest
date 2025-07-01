<?php
session_start();

// Initialize our “database” in session
if (!isset($_SESSION['users'])) {
    $_SESSION['users'] = [];  // email => [ 'first'=>…, 'last'=>…, 'password'=>hash ]
}

// Only handle form POSTs
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Only POST allowed');
}

// Decide register vs login
$isRegister = isset($_POST['firstname'], $_POST['lastname'], $_POST['email'], $_POST['newpassword']);

if ($isRegister) {
    // ─── Registration ─────────────────────────
    $fn = trim($_POST['firstname']);
    $ln = trim($_POST['lastname']);
    $em = trim($_POST['email']);
    $pw = $_POST['newpassword'];

    // Basic validation
    if (!$fn || !$ln || !filter_var($em, FILTER_VALIDATE_EMAIL) || !$pw) {
        $_SESSION['error'] = 'All fields required & must be valid.';
        header('Location: ../login.php');
        exit;
    }

    // Check for existing user
    if (isset($_SESSION['users'][$em])) {
        $_SESSION['error'] = 'Email already registered.';
    } else {
        // Store user
        $_SESSION['users'][$em] = [
            'first'    => $fn,
            'last'     => $ln,
            'password' => password_hash($pw, PASSWORD_DEFAULT)
        ];
        $_SESSION['message'] = 'Registration successful—please sign in.';
    }

    header('Location: ../login.php');
    exit;
}

// ─── Login ─────────────────────────────────────
$email = trim($_POST['username'] ?? '');
$pw    = $_POST['password'] ?? '';

if (!$email || !$pw) {
    $_SESSION['error'] = 'Email & password required.';
    header('Location: ../login.php');
    exit;
}

$user = $_SESSION['users'][$email] ?? null;
if ($user && password_verify($pw, $user['password'])) {
    // login OK
    $_SESSION['logged_in'] = $email;
    header('Location: ../portfolio.html');
} else {
    $_SESSION['error'] = 'Invalid credentials.';
    header('Location: ../login.php');
}
exit;
