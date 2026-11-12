/* ==========================================================
   admin-options.js — ให้แม่ค้าเพิ่ม / แก้ / ลบ "ตัวเลือกของเมนู" เอง
   ใช้ในหน้าร้าน (admin.html) ในฟอร์มเพิ่ม/แก้ไขเมนู · ต้องโหลดก่อน admin.js

   ตัวอย่างที่แม่ค้าสร้างได้:
   กลุ่ม "เลือกเนื้อสัตว์" (ต้องเลือก)   -> หมูสับ 0 บาท, ไก่ 0 บาท, หมูกรอบ +10 บาท
   กลุ่ม "เพิ่มเติม" (เลือกได้หลายอย่าง) -> ไข่ดาว +10 บาท, ไข่เจียว +10 บาท

   หลักการ:
   - เก็บตัวเลือกที่กำลังแก้ไว้ในตัวแปร editingOptions (รูปแบบเดียวกับ menu.options)
   - กดปุ่ม เพิ่ม/ลบ -> อ่านค่าจากช่องกรอกเก็บลงตัวแปรก่อน -> แก้ตัวแปร -> วาดใหม่
   - กดบันทึกเมนู -> อ่านค่า -> ตรวจความถูกต้อง -> ส่งให้ admin.js บันทึก

   สารบัญ
   1. เริ่มแก้ไข (เปิดฟอร์มเมนู)
   2. วาดช่องกรอก
   3. อ่านค่าจากช่องกรอก
   4. ปุ่ม เพิ่ม / ลบ
   5. ตรวจก่อนบันทึก
========================================================== */

let editingOptions = [];   // ตัวเลือกของเมนูที่กำลังแก้อยู่


/* ----------------------------------------------------------
   1. เริ่มแก้ไข: admin.js เรียกตอนเปิดฟอร์มเมนู
   menu = เมนูที่จะแก้ (ถ้าเพิ่มเมนูใหม่จะเป็น null)
---------------------------------------------------------- */
function startOptionsEditor(menu) {
    if (menu && menu.options) {
        // คัดลอกมาแก้ ไม่แก้ของจริงจนกว่าจะกดบันทึก
        editingOptions = JSON.parse(JSON.stringify(menu.options));
    } else {
        editingOptions = [];
    }
    drawOptionsEditor();
}


/* ----------------------------------------------------------
   2. วาดช่องกรอกจาก editingOptions
   ทุกช่องมี data-g (ลำดับกลุ่ม) และ data-c (ลำดับตัวเลือก)
   ไว้ให้ส่วนที่ 3 อ่านกลับว่าช่องนี้เป็นของกลุ่มไหน ตัวเลือกไหน
---------------------------------------------------------- */
function drawOptionsEditor() {
    let html = '';

    if (editingOptions.length === 0) {
        html = '<p class="muted">เมนูนี้ยังไม่มีตัวเลือก (ไม่มีก็ได้)</p>';
    }

    for (let g = 0; g < editingOptions.length; g++) {
        let group = editingOptions[g];

        html += '<div class="opt-group">';

        // หัวกลุ่ม: ชื่อกลุ่ม + ปุ่มลบกลุ่ม
        html += '<div class="opt-row">';
        html += '<input data-field="title" data-g="' + g + '" value="' + esc(group.title) + '" placeholder="ชื่อกลุ่ม เช่น เลือกเนื้อสัตว์">';
        html += '<button type="button" class="text-btn" data-action="remove-group" data-g="' + g + '">ลบกลุ่ม</button>';
        html += '</div>';

        // ตั้งค่ากลุ่ม
        html += '<label class="opt-check"><input type="checkbox" data-field="required" data-g="' + g + '"' +
            (group.required ? ' checked' : '') + '> ลูกค้าต้องเลือก</label>';
        html += '<label class="opt-check"><input type="checkbox" data-field="multiple" data-g="' + g + '"' +
            (group.multiple ? ' checked' : '') + '> เลือกได้หลายอย่าง</label>';

        // ตัวเลือกในกลุ่ม: ชื่อ + ราคาเพิ่ม + ปุ่มลบ
        for (let c = 0; c < group.choices.length; c++) {
            let choice = group.choices[c];
            html += '<div class="opt-row opt-choice-row">';
            html += '<input data-field="name" data-g="' + g + '" data-c="' + c + '" value="' + esc(choice.name) + '" placeholder="ชื่อตัวเลือก เช่น หมูกรอบ">';
            html += '<span>+</span>';
            html += '<input data-field="price" data-g="' + g + '" data-c="' + c + '" type="number" min="0" step="1" value="' + choice.price + '">';
            html += '<span>บาท</span>';
            html += '<button type="button" class="text-btn" data-action="remove-choice" data-g="' + g + '" data-c="' + c + '" title="ลบตัวเลือกนี้">✕</button>';
            html += '</div>';
        }

        html += '<button type="button" class="text-btn" data-action="add-choice" data-g="' + g + '">+ เพิ่มตัวเลือก</button>';
        html += '</div>';
    }

    document.getElementById('options-editor').innerHTML = html;
}


/* ----------------------------------------------------------
   3. อ่านค่าที่แม่ค้าพิมพ์ จากช่องกรอกกลับเข้า editingOptions
   (ต้องทำก่อนวาดใหม่ทุกครั้ง ไม่งั้นสิ่งที่พิมพ์ไว้จะหาย)
---------------------------------------------------------- */
function readOptionsEditor() {
    let inputs = document.querySelectorAll('#options-editor input');

    for (let i = 0; i < inputs.length; i++) {
        let input = inputs[i];
        let group = editingOptions[Number(input.dataset.g)];
        let field = input.dataset.field;

        if (field === 'title') group.title = input.value.trim();
        if (field === 'required') group.required = input.checked;
        if (field === 'multiple') group.multiple = input.checked;

        if (field === 'name') group.choices[Number(input.dataset.c)].name = input.value.trim();
        if (field === 'price') group.choices[Number(input.dataset.c)].price = Number(input.value);
    }
}


/* ----------------------------------------------------------
   4. ปุ่ม เพิ่ม / ลบ
   ขั้นตอนเหมือนกันทุกปุ่ม: อ่านค่า -> แก้ editingOptions -> วาดใหม่
---------------------------------------------------------- */
function optionsButton(event) {
    let button = event.target.closest('[data-action]');
    if (!button) return;

    let action = button.dataset.action;
    let g = Number(button.dataset.g);
    let c = Number(button.dataset.c);

    readOptionsEditor();

    if (action === 'add-group') {
        editingOptions.push({
            title: '',
            required: true,
            multiple: false,
            choices: [{ name: '', price: 0 }]
        });
    }
    if (action === 'remove-group') {
        editingOptions.splice(g, 1);           // ลบกลุ่มที่ g ออก 1 กลุ่ม
    }
    if (action === 'add-choice') {
        editingOptions[g].choices.push({ name: '', price: 0 });
    }
    if (action === 'remove-choice') {
        editingOptions[g].choices.splice(c, 1); // ลบตัวเลือกที่ c ออก 1 ตัว
    }

    drawOptionsEditor();
}


/* ----------------------------------------------------------
   5. ตรวจก่อนบันทึก: admin.js เรียกตอนกด "บันทึกเมนู"
   คืนค่า: รายการตัวเลือกที่พร้อมบันทึก / null = มีข้อผิดพลาด (แจ้งแม่ค้าแล้ว)
---------------------------------------------------------- */
function optionsForSave() {
    readOptionsEditor();

    let result = [];
    let groupTitles = [];

    for (let g = 0; g < editingOptions.length; g++) {
        let group = editingOptions[g];

        // ตัดแถวตัวเลือกที่ว่างทิ้ง (แม่ค้ากดเพิ่มแต่ไม่ได้พิมพ์)
        let choices = [];
        let choiceNames = [];
        for (let c = 0; c < group.choices.length; c++) {
            let choice = group.choices[c];
            if (choice.name === '') continue;

            if (!(choice.price >= 0)) return optionsError('ราคาของ "' + choice.name + '" ต้องเป็น 0 ขึ้นไป');
            if (choiceNames.indexOf(choice.name) !== -1) return optionsError('ตัวเลือก "' + choice.name + '" ซ้ำกันในกลุ่มเดียวกัน');

            choiceNames.push(choice.name);
            choices.push({ name: choice.name, price: choice.price });
        }

        // กลุ่มที่ว่างทั้งหมด (ไม่มีชื่อ ไม่มีตัวเลือก) -> ข้ามไปเลย
        if (group.title === '' && choices.length === 0) continue;

        if (group.title === '') return optionsError('กรุณาตั้งชื่อกลุ่มตัวเลือก (เช่น เลือกเนื้อสัตว์)');
        if (choices.length === 0) return optionsError('กลุ่ม "' + group.title + '" ต้องมีตัวเลือกอย่างน้อย 1 อย่าง');
        if (groupTitles.indexOf(group.title) !== -1) return optionsError('มีกลุ่มชื่อ "' + group.title + '" ซ้ำกัน');

        groupTitles.push(group.title);
        result.push({
            title: group.title,
            required: group.required,
            multiple: group.multiple,
            choices: choices
        });
    }
    return result;
}

// แจ้งข้อผิดพลาด แล้วคืนค่า null (ให้ admin.js รู้ว่ายังบันทึกไม่ได้)
function optionsError(text) {
    adminToast(text);
    return null;
}


/* ---------- ผูกปุ่ม (ปุ่มทั้งหมดอยู่ในกรอบ options-fieldset) ---------- */
document.getElementById('options-fieldset').addEventListener('click', optionsButton);
