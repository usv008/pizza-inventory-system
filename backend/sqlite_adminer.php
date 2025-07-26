<?php
// Спрощений Adminer для SQLite без пароля
function adminer_object() {
    class AdminerSoftware extends Adminer {
        function login($login, $password) {
            return true; // Дозволити підключення без пароля для SQLite
        }
        
        function credentials() {
            return array('', '', ''); // Порожні креденшали
        }
    }
    return new AdminerSoftware;
}

include "./adminer.php";
?>