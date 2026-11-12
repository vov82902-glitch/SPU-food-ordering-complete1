/* ==========================================================
   menu-options.js — หน้าต่างเลือกตัวเลือกเมนู (หน้า menu.html)
   เช่น ข้าวผัดกะเพรา -> เลือก หมู/ไก่, เพิ่มไข่ดาว, ระดับความเผ็ด
   ต้องโหลดหลัง main.js และก่อน menu.js (menu.js เรียกใช้ hasOptions / openOptions)

   ข้อมูลตัวเลือกอยู่ในเมนู (ดูตัวอย่างใน main.js):
   options: [
       { title: 'เลือกเนื้อสัตว์', required: true, multiple: false,
         choices: [ { name: 'หมูสับ', price: 0 }, { name: 'หมูกรอบ', price: 10 } ] }
   ]
   - required: true  = ต้องเลือก
   - multiple: false = เลือกได้อย่างเดียว -> ใช้ปุ่มวงกลม (radio)
   - multiple: true  = เลือกได้หลายอย่าง -> ใช้ช่องติ๊ก (checkbox)

   สารบัญ
   1. เปิด / ปิดหน้าต่าง
   2. วาดตัวเลือก
   3. คิดราคา
   4. อ่านตัวเลือกที่ลูกค้าเลือก
   5. เช็กว่าเลือกครบไหม
   6. กดเพิ่มลงตะกร้า
========================================================== */

let optionMenu = null;   // เมนูที่กำลังเลือกตัวเลือกอยู่


/* ----------------------------------------------------------
   1. เปิด / ปิดหน้าต่าง
---------------------------------------------------------- */

// เมนูนี้มีตัวเลือกไหม
function hasOptions(menu) {
    return menu.options && menu.options.length > 0;
}

function openOptions(menu) {
    optionMenu = menu;

    document.getElementById('options-title').textContent = menu.name;
    document.getElementById('options-base').textContent = 'ราคาเริ่มต้น ' + menu.price + ' บาท';
    document.getElementById('options-groups').innerHTML = optionsHtml(menu);
    document.getElementById('options-note').value = '';
    document.getElementById('options-error').textContent = '';

    updatePrice();
    document.getElementById('options-dialog').hidden = false;
}

function closeOptions() {
    document.getElementById('options-dialog').hidden = true;
    optionMenu = null;
}


/* ----------------------------------------------------------
   2. วาดตัวเลือก
   แต่ละช่องฝากข้อมูลไว้ใน data-group / data-choice (ลำดับกลุ่ม / ลำดับตัวเลือก)
   และ data-price ไว้ใช้คิดราคา
---------------------------------------------------------- */
function optionsHtml(menu) {
    let html = '';

    for (let g = 0; g < menu.options.length; g++) {
        let group = menu.options[g];

        // หัวข้อกลุ่ม เช่น "เลือกเนื้อสัตว์ (ต้องเลือก 1)"
        let hint = '';
        if (group.multiple) hint = 'เลือกได้หลายอย่าง';
        else if (group.required) hint = 'ต้องเลือก 1';
        else hint = 'ไม่บังคับ';

        // radio = เลือกได้อันเดียว / checkbox = เลือกได้หลายอัน
        let type = group.multiple ? 'checkbox' : 'radio';

        html += '<fieldset class="option-group" id="group-' + g + '">';
        html += '<legend>' + esc(group.title) + ' <small>(' + hint + ')</small></legend>';

        for (let c = 0; c < group.choices.length; c++) {
            let choice = group.choices[c];
            let priceText = choice.price > 0 ? '+' + choice.price + ' ฿' : '';
            let soldOut = choice.available === false;   // ร้านตั้งเป็น "หมด" -> กดไม่ได้
            if (soldOut) priceText = 'หมด';

            html += '<label class="option-choice' + (soldOut ? ' is-out' : '') + '">';
            html += '<input type="' + type + '" name="group-' + g + '"' +
                ' data-group="' + g + '" data-choice="' + c + '" data-price="' + choice.price + '"' +
                (soldOut ? ' disabled' : '') + '>';
            html += '<span>' + esc(choice.name) + '</span>';
            html += '<b>' + priceText + '</b>';
            html += '</label>';
        }
        html += '</fieldset>';
    }
    return html;
}


/* ----------------------------------------------------------
   3. คิดราคา = ราคาเมนู + ราคาตัวเลือกที่ติ๊กไว้
   เช่น กะเพรา 45 + หมูกรอบ 10 + ไข่ดาว 10 = 65
---------------------------------------------------------- */
function calcPrice() {
    let total = optionMenu.price;

    let checked = document.querySelectorAll('#options-groups input:checked');
    for (let i = 0; i < checked.length; i++) {
        total = total + Number(checked[i].dataset.price);
    }
    return total;
}

// ติ๊กอะไรก็ตาม -> อัปเดตราคาบนปุ่ม
function updatePrice() {
    document.getElementById('options-add').textContent = 'เพิ่มลงตะกร้า · ' + calcPrice() + ' บาท';
}


/* ----------------------------------------------------------
   4. อ่านตัวเลือกที่ลูกค้าเลือก
   ได้เป็น [ { group: 'เลือกเนื้อสัตว์', name: 'หมูกรอบ', price: 10 }, ... ]
---------------------------------------------------------- */
function getChosen() {
    let chosen = [];

    let checked = document.querySelectorAll('#options-groups input:checked');
    for (let i = 0; i < checked.length; i++) {
        let group = optionMenu.options[Number(checked[i].dataset.group)];
        let choice = group.choices[Number(checked[i].dataset.choice)];

        chosen.push({ group: group.title, name: choice.name, price: choice.price });
    }
    return chosen;
}


/* ----------------------------------------------------------
   5. เช็กว่าเลือกครบไหม
   กลุ่มที่ required ต้องมีอย่างน้อย 1 ช่องถูกติ๊ก
   คืนค่า: '' = ครบแล้ว / ข้อความ = ยังขาดกลุ่มไหน
---------------------------------------------------------- */
function checkRequired() {
    for (let g = 0; g < optionMenu.options.length; g++) {
        let group = optionMenu.options[g];
        if (!group.required) continue;

        let picked = document.querySelector('#group-' + g + ' input:checked');
        if (picked === null) {
            document.getElementById('group-' + g).scrollIntoView({ block: 'center' });
            return 'กรุณา' + group.title;
        }
    }
    return '';
}


/* ----------------------------------------------------------
   6. กดเพิ่มลงตะกร้า
---------------------------------------------------------- */
function submitOptions(event) {
    event.preventDefault();   // ไม่ให้ฟอร์มรีโหลดหน้า

    let error = checkRequired();
    document.getElementById('options-error').textContent = error;
    if (error !== '') return;

    let note = document.getElementById('options-note').value.trim();
    putInCart(optionMenu, note, getChosen(), calcPrice());   // putInCart อยู่ใน menu.js
    closeOptions();
}


/* ---------- ผูกปุ่มต่างๆ (ทำครั้งเดียวตอนโหลดหน้า) ---------- */
document.getElementById('options-form').addEventListener('submit', submitOptions);
document.getElementById('options-groups').addEventListener('change', updatePrice);
document.getElementById('options-cancel').addEventListener('click', closeOptions);

// กดพื้นหลังสีเทา หรือกด Esc -> ปิดหน้าต่าง
document.getElementById('options-dialog').addEventListener('click', function (event) {
    if (event.target === this) closeOptions();
});
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && optionMenu !== null) closeOptions();
});
