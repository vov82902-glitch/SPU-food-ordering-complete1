// ลืมรหัสผ่าน (นักศึกษา): ยืนยันตัวตนด้วยรหัสนักศึกษา + ชื่อ + เบอร์โทรที่สมัครไว้ แล้วตั้งรหัสใหม่
let verifiedStudent = null;   // รหัสนักศึกษาที่ยืนยันตัวตนผ่านแล้ว (เก็บในหน้านี้เท่านั้น)

let verifyForm = document.getElementById('verify-form');
let resetForm = document.getElementById('reset-form');

['fp-student', 'fp-phone'].forEach(function (id) {
    let input = document.getElementById(id);
    input.addEventListener('input', function () { input.value = input.value.replace(/[^0-9]/g, ''); });
});

let presetId = new URLSearchParams(location.search).get('student');
if (presetId && /^[0-9]{8}$/.test(presetId)) document.getElementById('fp-student').value = presetId;

document.querySelectorAll('[data-toggle-pass]').forEach(function (btn) {
    btn.addEventListener('click', function () {
        let input = document.getElementById(btn.dataset.togglePass);
        let show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'ซ่อน' : 'แสดง';
    });
});

function fpError(id, text) {
    let field = document.getElementById(id).closest('.field');
    field.classList.toggle('invalid', !!text);
    field.querySelector('.field-error').innerHTML = text || '';
    return !text;
}

function verifyMessage(html) {
    document.getElementById('verify-error').innerHTML = html || '';
}

[verifyForm, resetForm].forEach(function (form) {
    form.querySelectorAll('input').forEach(function (input) {
        input.addEventListener('input', function () {
            let field = input.closest('.field');
            if (field && field.classList.contains('invalid')) fpError(input.id, '');
            if (form === verifyForm) verifyMessage('');
        });
    });
});

verifyForm.addEventListener('submit', function (event) {
    event.preventDefault();
    let student = document.getElementById('fp-student').value.trim();
    let name = document.getElementById('fp-name').value;
    let phone = document.getElementById('fp-phone').value.trim();

    let ok = true;
    ok = fpError('fp-student', /^[0-9]{8}$/.test(student) ? '' : 'รหัสนักศึกษาต้องเป็นตัวเลข 8 หลัก') && ok;
    ok = fpError('fp-name', name.trim().length < 2 ? 'กรุณากรอกชื่อ-นามสกุล' : '') && ok;
    ok = fpError('fp-phone', /^0[0-9]{8,9}$/.test(phone) ? '' : 'กรอกเบอร์โทร 9–10 หลัก เช่น 0812345678') && ok;
    if (!ok) return;

    let key = 'student:' + student;
    let wait = lockedSeconds(key);
    if (wait > 0) { verifyMessage('กรอกผิดหลายครั้ง กรุณารอ ' + wait + ' วินาทีแล้วลองใหม่'); return; }

    let account = loadStudents()[student];
    if (account && !account.pass) {
        verifyMessage('บัญชีนี้ยังไม่มีรหัสผ่าน กรุณาติดต่อเจ้าหน้าที่โรงอาหารเพื่อตั้งรหัสผ่าน');
        return;
    }
    if (account && !account.phone) {
        verifyMessage('บัญชีนี้ไม่ได้ลงทะเบียนเบอร์โทรไว้ จึงตั้งรหัสผ่านใหม่เองไม่ได้ กรุณาติดต่อเจ้าหน้าที่โรงอาหาร');
        return;
    }
    if (!account || !sameName(account.name, name) || !samePhone(account.phone, phone)) {
        let left = noteFailedTry(key);
        verifyMessage(left > 0
            ? 'ข้อมูลไม่ตรงกับบัญชีใด ตรวจสอบอีกครั้ง (เหลือ ' + left + ' ครั้ง)'
            : 'กรอกผิดหลายครั้ง กรุณารอ ' + lockedSeconds(key) + ' วินาทีแล้วลองใหม่');
        return;
    }

    clearTries(key);
    verifiedStudent = student;
    document.getElementById('reset-who').textContent = account.name + ' (' + student + ')';
    verifyForm.hidden = true;
    resetForm.hidden = false;
    document.getElementById('step-1').className = 'done';
    document.getElementById('step-2').className = 'now';
    document.getElementById('fp-pass').focus();
});

resetForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!verifiedStudent) { location.reload(); return; }
    let pass = document.getElementById('fp-pass').value;
    let pass2 = document.getElementById('fp-pass2').value;
    let students = loadStudents();
    let account = students[verifiedStudent];
    if (!account) { location.reload(); return; }

    let ok = true;
    let msg = '';
    if (pass.length < 6) msg = 'รหัสผ่านอย่างน้อย 6 ตัวอักษร';
    else if (account.pass === passwordHash(verifiedStudent, pass)) msg = 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม';
    ok = fpError('fp-pass', msg) && ok;
    ok = fpError('fp-pass2', pass2 !== pass ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : '') && ok;
    if (!ok) return;

    account.pass = passwordHash(verifiedStudent, pass);
    account.passChangedAt = Date.now();
    saveStudents(students);

    resetForm.hidden = true;
    document.getElementById('step-2').className = 'done';
    document.getElementById('reset-done').hidden = false;
    document.getElementById('done-login').href = 'index.html?student=' + verifiedStudent;
    verifiedStudent = null;
});
