/* ==========================================================
   register.js — หน้าสมัครสมาชิกนักศึกษา (register.html)
   ต้องโหลดหลัง main.js
========================================================== */

let regForm = document.getElementById('register-form');


/* ---------- 1) ช่องรหัสนักศึกษาและเบอร์โทร: พิมพ์ได้เฉพาะตัวเลข ---------- */
['reg-student', 'reg-phone'].forEach(function (id) {
    let input = document.getElementById(id);
    input.addEventListener('input', function () {
        input.value = input.value.replace(/[^0-9]/g, '');
    });
});

// ถ้ามาจากหน้าเข้าสู่ระบบ (ลิงก์มี ?student=...) ใส่รหัสนักศึกษาให้เลย
let presetStudent = new URLSearchParams(location.search).get('student');
if (presetStudent && /^[0-9]{8}$/.test(presetStudent)) {
    document.getElementById('reg-student').value = presetStudent;
}


/* ---------- 2) ปุ่มแสดง/ซ่อนรหัสผ่าน ---------- */
document.querySelectorAll('[data-toggle-pass]').forEach(function (btn) {
    btn.addEventListener('click', function () {
        let input = document.getElementById(btn.dataset.togglePass);
        let show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'ซ่อน' : 'แสดง';
    });
});


/* ---------- 3) ข้อความผิดพลาดใต้แต่ละช่อง ---------- */

// แสดงข้อความผิดพลาดใต้ช่อง id (ส่ง '' = ไม่มีข้อผิดพลาด)
// คืนค่า true ถ้าช่องนี้ถูกต้อง
function fieldError(id, text) {
    let field = document.getElementById(id).closest('.field');
    let msg = field.querySelector('.field-error');
    field.classList.toggle('invalid', !!text);
    msg.innerHTML = text || '';
    return !text;
}

// เริ่มพิมพ์แก้เมื่อไหร่ ซ่อนข้อความผิดพลาดของช่องนั้น
regForm.querySelectorAll('input').forEach(function (input) {
    input.addEventListener('input', function () {
        let field = input.closest('.field');
        if (field && field.classList.contains('invalid')) fieldError(input.id, '');
    });
});


/* ---------- 4) กดปุ่มสมัครสมาชิก ---------- */
regForm.addEventListener('submit', function (event) {
    event.preventDefault();   // กันไม่ให้ฟอร์มรีโหลดหน้า

    // อ่านค่าจากฟอร์ม
    let name = document.getElementById('reg-name').value.trim().replace(/\s+/g, ' ');
    let student = document.getElementById('reg-student').value.trim();
    let phone = document.getElementById('reg-phone').value.trim();
    let pass = document.getElementById('reg-pass').value;
    let pass2 = document.getElementById('reg-pass2').value;
    let students = loadStudents();

    // ข้อความผิดพลาดของแต่ละช่อง ('' = ถูกต้อง)
    let nameMsg = '';
    if (name.length < 2) nameMsg = 'กรุณากรอกชื่อ-นามสกุล';

    let studentMsg = '';
    if (!/^[0-9]{8}$/.test(student)) {
        studentMsg = 'รหัสนักศึกษาต้องเป็นตัวเลข 8 หลัก';
    } else if (students[student]) {
        studentMsg = 'รหัสนี้สมัครไว้แล้ว <a href="index.html?student=' + student + '">เข้าสู่ระบบ</a>';
    }

    let phoneMsg = '';   // เบอร์โทรไม่บังคับ แต่ถ้ากรอกต้องถูกรูปแบบ
    if (phone && !/^0[0-9]{8,9}$/.test(phone)) phoneMsg = 'เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)';

    let passMsg = '';
    if (pass.length < 6) passMsg = 'รหัสผ่านอย่างน้อย 6 ตัวอักษร';

    let pass2Msg = '';
    if (pass2 !== pass) pass2Msg = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';

    // แสดงข้อความทุกช่อง (ใช้ & เพื่อให้ตรวจครบทุกช่อง ไม่หยุดที่ช่องแรก)
    let ok = fieldError('reg-name', nameMsg)
           & fieldError('reg-student', studentMsg)
           & fieldError('reg-phone', phoneMsg)
           & fieldError('reg-pass', passMsg)
           & fieldError('reg-pass2', pass2Msg);

    if (!ok) {
        // เลื่อนเคอร์เซอร์ไปช่องแรกที่ผิด
        let first = regForm.querySelector('.field.invalid input');
        if (first) first.focus();
        return;
    }

    // บันทึกบัญชีใหม่ลง localStorage (เก็บรหัสผ่านแบบแฮช)
    students[student] = {
        name: name,
        phone: phone,
        pass: passwordHash(student, pass),
        createdAt: Date.now()
    };
    saveStudents(students);

    // สมัครเสร็จ เข้าสู่ระบบให้เลย
    setCurrentUser(name, student);
    cloudGo('floors.html?welcome=1');   // รอบันทึกขึ้น Firebase ก่อนเปลี่ยนหน้า
});
