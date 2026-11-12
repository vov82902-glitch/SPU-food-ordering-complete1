/* ==========================================================
   queue-choice.js — กล่อง "ของหมด กรุณาเลือกใหม่" ในหน้าคิวของลูกค้า
   ใช้ใน queue.html · ต้องโหลดหลัง out-of-stock.js และก่อน queue.js

   หน้าตา:
   ┌ หมูกรอบหมด กรุณาเลือกใหม่ ─────────┐
   │ ข้าวผัดกะเพรา · เลือกเนื้อสัตว์         │
   │  ○ หมูสับ               ถูกลง 10 ฿ │
   │  ○ ไก่                  ถูกลง 10 ฿ │
   │  ○ ทะเล                +10 ฿      │
   │ ⏱ เลือกภายใน 3 นาที                 │
   │ [ยืนยัน]       [ไม่เอาเมนูนี้]        │
   └────────────────────────────────┘

   สารบัญ
   1. วาดกล่องเลือกใหม่
   2. จำว่าลูกค้าติ๊กอะไรไว้
   3. กดยืนยัน / ไม่เอาเมนูนี้
========================================================== */

// จำตัวเลือกที่ลูกค้าติ๊กไว้ เพราะหน้าคิววาดใหม่ทุก 3 วินาที (ไม่งั้นที่ติ๊กไว้จะหาย)
// รูปแบบ: { 'รหัสออเดอร์-ลำดับรายการ': 'ชื่อตัวเลือก' }
let picked = {};


/* ----------------------------------------------------------
   1. วาดกล่องเลือกใหม่ (queue.js เรียกใช้ตอนวาดบัตรคิว)
---------------------------------------------------------- */
function choiceBoxHtml(order) {
    if (order.status !== 'new' && order.status !== 'cooking') return '';

    let html = '';
    for (let i = 0; i < order.items.length; i++) {
        let item = order.items[i];
        if (!item.pendingChoice) continue;

        let menu = menuOfItem(order, item);             // out-of-stock.js
        if (menu === null) continue;
        let group = findGroup(menu, item.pendingChoice.group);
        let choices = alternativesFor(menu, item);      // ของที่ยังมี
        let outPrice = pendingPrice(item);              // ราคาของที่หมด
        let key = order.id + '-' + i;

        html += '<div class="choice-box">';
        html += '<p class="choice-title">⚠ ' + esc(item.pendingChoice.name) + 'หมด กรุณาเลือกใหม่</p>';
        html += '<p class="choice-sub">' + esc(item.name) + ' · ' + esc(item.pendingChoice.group) + '</p>';

        // ตัวเลือกที่ยังมี + บอกส่วนต่างราคา
        for (let c = 0; c < choices.length; c++) {
            html += choiceRow(key, choices[c].name, choices[c].price - outPrice);
        }
        // กลุ่มไม่บังคับ (เช่น ไข่ดาว) -> เลือก "ไม่ใส่" ได้
        if (group && !group.required) {
            html += choiceRow(key, '', -outPrice);
        }

        html += '<p class="choice-time">⏱ เลือกภายใน ' + minutesLeft(item) + ' นาที ไม่งั้นระบบจะ' +
            (group && !group.required ? 'ไม่ใส่' + esc(item.pendingChoice.name) + 'ให้' : 'ตัดเมนูนี้ออก') + '</p>';
        html += '<div class="choice-actions">';
        html += '<button class="btn-choice" onclick="submitChoice(\'' + order.id + '\', ' + i + ')">ยืนยัน</button>';
        html += '<button class="btn-cancel" onclick="submitDecline(\'' + order.id + '\', ' + i + ')">ไม่เอาเมนูนี้</button>';
        html += '</div>';
        html += '</div>';
    }
    return html;
}

// 1 แถวตัวเลือก: ○ ไก่   ถูกลง 10 ฿
function choiceRow(key, name, diff) {
    let label = name === '' ? 'ไม่ต้องใส่อะไรแทน' : esc(name);
    let diffText = 'ราคาเดิม';
    if (diff > 0) diffText = '+' + diff + ' ฿';
    if (diff < 0) diffText = 'ถูกลง ' + (-diff) + ' ฿';

    let checked = picked[key] === name ? ' checked' : '';
    return '<label class="choice-row">' +
        '<input type="radio" name="pick-' + key + '" value="' + esc(name) + '"' + checked +
        ' onchange="rememberPick(\'' + key + '\', this.value)">' +
        '<span>' + label + '</span><small>' + diffText + '</small></label>';
}

// เหลือเวลาเลือกกี่นาที (ปัดขึ้น เช่น เหลือ 1 นาที 10 วินาที -> 2 นาที)
function minutesLeft(item) {
    let used = Date.now() - item.pendingChoice.askedAt;
    let left = CHOOSE_MINUTES * 60000 - used;
    return Math.max(1, Math.ceil(left / 60000));
}


/* ----------------------------------------------------------
   2. จำว่าลูกค้าติ๊กอะไรไว้
---------------------------------------------------------- */
function rememberPick(key, name) {
    picked[key] = name;
}


/* ----------------------------------------------------------
   3. กดยืนยัน / ไม่เอาเมนูนี้ (ใช้ฟังก์ชันใน out-of-stock.js)
---------------------------------------------------------- */
function submitChoice(orderId, itemIndex) {
    let key = orderId + '-' + itemIndex;
    if (picked[key] === undefined) {
        showToast('กรุณาเลือกของแทนก่อนกดยืนยัน', 'bad');
        return;
    }

    let error = chooseReplacement(orderId, itemIndex, picked[key]);
    if (error !== '') {
        showToast(esc(error), 'bad');
    } else {
        showToast('เปลี่ยนเรียบร้อย ร้านจะทำต่อให้เลย', 'ok');
    }
    delete picked[key];
    renderQueue();   // queue.js
}

function submitDecline(orderId, itemIndex) {
    let error = declineItem(orderId, itemIndex);
    if (error !== '') {
        showToast(esc(error), 'bad');
    } else {
        showToast('ตัดเมนูนี้ออกแล้ว');
    }
    delete picked[orderId + '-' + itemIndex];
    renderQueue();
}
