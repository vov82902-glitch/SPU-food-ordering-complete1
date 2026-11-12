/* ==========================================================
   admin-cancel.js — หน้าต่างยกเลิกออเดอร์ (หน้าร้าน)
   ใช้ใน admin.html · ต้องโหลดก่อน admin.js

   แทนกล่องให้พิมพ์เหตุผล ด้วยปุ่มเหตุผลให้กดเลือก:
     [วัตถุดิบหมด] [ทำไม่ทัน ออเดอร์เยอะ] [ร้านกำลังจะปิด] [ลูกค้าขอยกเลิก] [อื่นๆ]
   กดเลือกเหตุผล -> กด "ยืนยันยกเลิก" (2 ครั้ง กันกดพลาด)
   ลูกค้าจะเห็นเหตุผลนี้ในหน้าคิว

   สารบัญ
   1. รายการเหตุผล
   2. เปิด / ปิดหน้าต่าง
   3. เลือกเหตุผล
   4. ยืนยันยกเลิก
========================================================== */


/* ----------------------------------------------------------
   1. รายการเหตุผล (เพิ่ม/แก้ข้อความได้ที่นี่)
---------------------------------------------------------- */
const CANCEL_REASONS = [
    'วัตถุดิบหมด',
    'ทำไม่ทัน ออเดอร์เยอะ',
    'ร้านกำลังจะปิด',
    'ลูกค้าขอยกเลิก',
    'อื่นๆ'          // เลือกแล้วจะมีช่องให้พิมพ์เอง
];

let cancelOrderId = null;   // ออเดอร์ที่กำลังจะยกเลิก
let cancelReason = '';      // เหตุผลที่เลือก


/* ----------------------------------------------------------
   2. เปิด / ปิดหน้าต่าง (admin.js เรียกตอนกด "ยกเลิกออเดอร์")
---------------------------------------------------------- */
function openCancelDialog(order) {
    cancelOrderId = order.id;
    cancelReason = '';

    let html = '';
    for (let i = 0; i < CANCEL_REASONS.length; i++) {
        html += '<button type="button" class="reason-btn" data-reason="' + CANCEL_REASONS[i] + '">' + CANCEL_REASONS[i] + '</button>';
    }

    $('cancel-title').textContent = 'ยกเลิกคิว ' + order.queue + '?';
    $('cancel-reasons').innerHTML = html;
    $('cancel-other').value = '';
    $('cancel-other').hidden = true;
    $('cancel-hint').hidden = true;
    $('cancel-confirm').disabled = true;   // ต้องเลือกเหตุผลก่อน
    $('cancel-dialog').classList.remove('hidden');
}

function closeCancelDialog() {
    cancelOrderId = null;
    $('cancel-dialog').classList.add('hidden');
}


/* ----------------------------------------------------------
   3. เลือกเหตุผล: ปุ่มที่กดเป็นสีชมพู
---------------------------------------------------------- */
function pickReason(event) {
    let button = event.target.closest('[data-reason]');
    if (!button) return;

    cancelReason = button.dataset.reason;

    // ไฮไลต์ปุ่มที่เลือก
    let all = document.querySelectorAll('#cancel-reasons .reason-btn');
    for (let i = 0; i < all.length; i++) {
        all[i].classList.toggle('is-picked', all[i] === button);
    }

    // "อื่นๆ" -> โชว์ช่องพิมพ์
    $('cancel-other').hidden = cancelReason !== 'อื่นๆ';
    if (cancelReason === 'อื่นๆ') $('cancel-other').focus();

    // "วัตถุดิบหมด" -> แนะนำปุ่ม "ของหมด" ที่ให้ลูกค้าเลือกของแทนได้
    $('cancel-hint').hidden = cancelReason !== 'วัตถุดิบหมด';

    $('cancel-confirm').disabled = false;
}


/* ----------------------------------------------------------
   4. ยืนยันยกเลิก
---------------------------------------------------------- */
function confirmCancel() {
    let reason = cancelReason;
    if (reason === 'อื่นๆ') {
        reason = $('cancel-other').value.trim();
        if (reason === '') {
            adminToast('กรุณาพิมพ์เหตุผล');
            return;
        }
    }

    let orders = loadOrders();
    let order = null;
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === cancelOrderId) order = orders[i];
    }

    // ตรวจอีกครั้ง เผื่อสถานะเปลี่ยนระหว่างเปิดหน้าต่าง (เช่น ลูกค้ายกเลิกเองไปแล้ว)
    if (!order || (order.status !== 'new' && order.status !== 'cooking')) {
        adminToast('สถานะออเดอร์เปลี่ยนไปแล้ว');
        closeCancelDialog();
        renderAll();
        return;
    }

    order.status = 'cancelled';
    order.cancelledBy = 'store';
    order.cancelReason = reason;
    order.cancelledAt = Date.now();
    order.updatedAt = Date.now();
    saveOrders(orders);

    adminToast('ยกเลิกคิว ' + order.queue + ' แล้ว · ' + reason);
    closeCancelDialog();
    renderAll();
}


/* ---------- ผูกปุ่ม ---------- */
document.getElementById('cancel-reasons').addEventListener('click', pickReason);
document.getElementById('cancel-back').addEventListener('click', closeCancelDialog);
document.getElementById('cancel-confirm').addEventListener('click', confirmCancel);
document.getElementById('cancel-dialog').addEventListener('click', function (event) {
    if (event.target === this) closeCancelDialog();
});
