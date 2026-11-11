/* ==========================================================
   login.js — หน้าเข้าสู่ระบบ (index.html)
   ต้องโหลดหลัง main.js
========================================================== */

let loginForm = document.getElementById('login-form');
let studentInput = document.getElementById('student');


/* ---------- 1) ช่องรหัสนักศึกษา: พิมพ์ได้เฉพาะตัวเลข ---------- */
studentInput.oninput = function () {
    studentInput.value = studentInput.value.replace(/[^0-9]/g, '');
};

// ถ้ามาจากหน้าสมัครสมาชิก (ลิงก์มี ?student=...) ใส่รหัสนักศึกษาให้เลย
let presetStudent = new URLSearchParams(location.search).get('student');
if (presetStudent && isStudentId(presetStudent)) {
    studentInput.value = presetStudent;
}


/* ---------- 2) ลิงก์ "ลืมรหัสผ่าน": ส่งรหัสนักศึกษาที่พิมพ์ไว้ไปด้วย ---------- */
let forgotLink = document.getElementById('forgot-link');
if (forgotLink) {
    forgotLink.addEventListener('click', function () {
        if (isStudentId(studentInput.value)) {
            forgotLink.href = 'forgot.html?student=' + studentInput.value;
        }
    });
}


/* ---------- 3) ปุ่มแสดง/ซ่อนรหัสผ่าน ---------- */
document.querySelectorAll('[data-toggle-pass]').forEach(function (btn) {
    btn.addEventListener('click', function () {
        let input = document.getElementById(btn.dataset.togglePass);
        let show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'ซ่อน' : 'แสดง';
    });
});


/* ---------- 4) เข้าสู่ระบบ ---------- */

// รหัสนักศึกษาต้องเป็นตัวเลข 8 หลัก
function isStudentId(text) {
    return /^[0-9]{8}$/.test(text);
}

// แสดงข้อความผิดพลาดใต้ฟอร์ม (ส่ง '' เพื่อล้างข้อความ)
function showLoginError(html) {
    let box = document.getElementById('login-error');
    if (box) {
        box.innerHTML = html;
    } else if (html) {
        alert(html.replace(/<[^>]+>/g, ''));
    }
}

function login(event, form) {
    event.preventDefault();   // กันไม่ให้ฟอร์มรีโหลดหน้า

    let student = form.elements.student.value.trim();
    let passInput = form.elements.password;

    if (!isStudentId(student)) {
        showLoginError('รหัสนักศึกษาต้องเป็นตัวเลข 8 หลัก');
        return;
    }

    let name;

    if (!passInput) {
        // หน้าเก่าที่ไม่มีช่องรหัสผ่าน (เช่นในโฟลเดอร์ merchant) ใช้ชื่ออย่างเดียวเหมือนเดิม
        name = form.elements.nickname ? form.elements.nickname.value.trim() : '';
        if (name === '') {
            showLoginError('กรุณากรอกชื่อ');
            return;
        }
    } else {
        // หาบัญชีจากรหัสนักศึกษา
        let account = loadStudents()[student];

        // ไม่มีบัญชีนี้
        if (!account) {
            showLoginError('ไม่พบบัญชีรหัสนี้ <a href="register.html?student=' + student + '">สมัครสมาชิก</a>');
            return;
        }

        // บัญชีเก่าที่ไม่มีรหัสผ่าน (เคยสมัครด้วยโซเชียลซึ่งเลิกใช้แล้ว)
        if (!account.pass) {
            showLoginError('บัญชีนี้ยังไม่มีรหัสผ่าน กรุณาติดต่อเจ้าหน้าที่โรงอาหารเพื่อตั้งรหัสผ่าน');
            return;
        }

        // ตรวจรหัสผ่าน: แฮชรหัสที่พิมพ์ แล้วเทียบกับแฮชที่เก็บไว้
        if (account.pass !== passwordHash(student, passInput.value)) {
            showLoginError('รหัสผ่านไม่ถูกต้อง <a href="forgot.html?student=' + student + '">ลืมรหัสผ่าน?</a>');
            return;
        }

        name = account.name;
    }

    // ผ่านทุกอย่าง: บันทึกผู้ใช้ลง localStorage แล้วไปหน้าเลือกชั้น
    showLoginError('');
    setCurrentUser(name, student);
    location.href = 'floors.html';
}

if (loginForm && !loginForm.getAttribute('onsubmit')) {
    loginForm.addEventListener('submit', function (event) {
        login(event, loginForm);
    });
}
