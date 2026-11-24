/* Kitchen print station for MORI/PeeYai: owner-authenticated polling, one ticket per order.
 * Windows + Chrome --kiosk-printing + installed default POS58 printer.
 * Print state is local to THIS station/browser. Use only one automatic station per kitchen.
 */
(() => {
  'use strict';
  const storeKey = 'peeyai_kitchen_print_v1';
  const enabledKey = 'peeyai_kitchen_enabled_v1';
  const $ = id => document.getElementById(id);
  const escHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const state = {records:{},enabled:false,ready:false,checking:false,printing:false,orders:[],lastError:''};
  let timer=null;
  const save = () => localStorage.setItem(storeKey,JSON.stringify(state.records));
  const putStatus=(message,detail,on)=>{ $('connection').textContent=message;$('statusDetail').textContent=detail;$('signal').classList.toggle('on',!!on) };
  const safeDate=value=>{const d=new Date(value);return isNaN(d.getTime())?'-':d.toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})};
  const getId=o=>String(o.id);
  const displayItems=o=>(o.items||[]).map(i=>`${Number(i.qty)||0} × ${i.name||'-'}`).join(' / ');
  const escapeTicket=o=>{
    const lines=(o.items||[]).map(i=>{
      const opts=typeof optionsText==='function'?optionsText(i.options):'';
      return `<div class="line-item"><span class="qty">${Math.max(1,Number(i.qty)||1)} ×</span><div><div class="dish">${escHtml(i.name||'-')}</div>${opts?`<div class="details">${escHtml(opts)}</div>`:''}</div></div>`;
    }).join('');
    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
      @page{size:58mm auto;margin:0}*{box-sizing:border-box}html,body{width:58mm;margin:0;padding:0;background:#fff;color:#111;font-family:Tahoma,"Noto Sans Thai",sans-serif}
      .paper{width:58mm;padding:2mm 1.7mm 3mm}.center{text-align:center}.title{font-size:19px;font-weight:700}.table{font-size:27px;font-weight:700;margin:7px 0}.info{font-size:13px}.cut{border-top:1px dashed #333;margin:8px 0}.line-item{display:flex;gap:8px;align-items:flex-start;break-inside:avoid;margin:10px 0}.qty{font-size:21px;font-weight:700;min-width:30px}.dish{font-size:17px;font-weight:600;overflow-wrap:anywhere}.details{font-size:13px;margin-top:3px}.foot{text-align:center;font-size:12px;margin-top:10px}
    </style></head><body><div class="paper"><div class="center title">ใบสั่งอาหารเข้าครัว</div><div class="center table">โต๊ะ ${escHtml(o.table_code||'-')}</div><div class="center info">ออเดอร์ ${escHtml(o.number||o.id)}</div><div class="center info">${escHtml(safeDate(o.created_at))}</div><div class="cut"></div>${lines||'<div>ไม่มีรายการอาหาร</div>'}<div class="cut"></div><div class="foot">*** ออเดอร์ใหม่ ***</div></div></body></html>`;
  };
  async function printHtml(html){
    const host=$('printHost');host.replaceChildren();const frame=document.createElement('iframe');frame.setAttribute('title','ใบครัว');host.append(frame);
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('โหลดเอกสารพิมพ์ไม่สำเร็จ')),8000);
      frame.onload=async()=>{clearTimeout(timeout);try{await frame.contentDocument.fonts.ready}catch{}resolve()};
      frame.srcdoc=html;
    });
    frame.contentWindow.focus();frame.contentWindow.print();
    // Browser print() reports print-dialog dispatch, NOT physical printer success.
    await new Promise(resolve=>setTimeout(resolve,2000));
    frame.remove();
  }
  async function printOrder(o,reprint=false){
    if(state.printing)return;
    state.printing=true;
    const id=getId(o);
    try{
      // Persist before printing to avoid automatic duplicate after refresh/crash.
      // If physical printer fails, use the manual reprint button.
      state.records[id]={requestedAt:new Date().toISOString(),number:o.number||id,table:o.table_code||'',manual:reprint};save();render();
      await printHtml(escapeTicket(o));
      putStatus('ส่งคำสั่งพิมพ์แล้ว','ตรวจสอบว่า POS58 พิมพ์กระดาษออกจริง',true);
    }catch(e){
      delete state.records[id];save();putStatus('ส่งพิมพ์ไม่สำเร็จ',String(e.message||e),false);
    }finally{state.printing=false;render()}
  }
  function render(){
    $('enable').disabled=!state.ready;
    $('enable').textContent=state.enabled?'⏸ ปิดพิมพ์อัตโนมัติ':'▶ เปิดพิมพ์อัตโนมัติ';
    $('test').disabled=!state.ready;
    $('scan').disabled=!state.ready;
    $('total').textContent=state.orders.length;
    $('orders').innerHTML=state.orders.slice(0,80).map(o=>{
      const done=!!state.records[getId(o)];
      return `<article class="order"><h3>โต๊ะ ${escHtml(o.table_code)} <span class="tag ${done?'':'pending'}">${done?'ส่งพิมพ์แล้ว':'ยังไม่ส่งพิมพ์'}</span></h3><p>${escHtml(o.number||o.id)} · ${escHtml(safeDate(o.created_at))}</p><p>${escHtml(displayItems(o))}</p><button data-reprint="${escHtml(getId(o))}">${done?'🖨️ พิมพ์ซ้ำ':'🖨️ พิมพ์ใบนี้'}</button></article>`;
    }).join('')||'<p>ยังไม่มีออเดอร์</p>';
    $('orders').querySelectorAll('[data-reprint]').forEach(btn=>btn.onclick=()=>{const o=state.orders.find(o=>getId(o)===btn.dataset.reprint);if(o)printOrder(o,true)});
  }
  async function check(initial=false){
    if(state.checking || !state.ready)return;
    state.checking=true;
    try{
      // api.orders reads orders + order_items with the existing owner RLS policies.
      const data=await api.orders();
      const current=data.filter(o=>o.status!=='cancelled').sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
      state.orders=current.slice().reverse();
      if(initial){
        // Start watching from NOW: don't automatically print historical orders.
        current.forEach(o=>{const id=getId(o);if(!state.records[id])state.records[id]={requestedAt:null,baseline:true,number:o.number,table:o.table_code}});save();
      } else if(state.enabled){
        const pending=current.filter(o=>!state.records[getId(o)]);
        // Queue is short, sequential; avoid simultaneous printer jobs.
        for(const o of pending){await printOrder(o)}
      }
      if(!state.printing)putStatus(state.enabled?'กำลังเฝ้าออเดอร์ใหม่':'เชื่อมต่อแล้ว · ยังไม่เปิดพิมพ์อัตโนมัติ',state.enabled?'ตรวจสอบทุก 3 วินาที · เปิดหน้านี้ไว้ตลอด':'กด “เปิดพิมพ์อัตโนมัติ” เมื่อเครื่องพิมพ์พร้อม',state.enabled);
    }catch(e){putStatus('เชื่อมต่อข้อมูลไม่สำเร็จ',String(e.message||e),false)}finally{state.checking=false;render()}
  }
  async function start(){
    try{
      const raw=JSON.parse(localStorage.getItem(storeKey)||'{}');state.records=(raw&&typeof raw==='object'&&!Array.isArray(raw))?raw:{};
    }catch{state.records={}}
    if(!window.cloud){putStatus('ยังไม่เชื่อม Supabase','ตรวจ config.js; ห้ามใช้โหมดตัวอย่างในการพิมพ์จริง',false);return}
    try{
      const {data:{user},error}=await supa.auth.getUser();if(error||!user){putStatus('ยังไม่ได้เข้าสู่ระบบ','กรุณาเข้าหน้า owner.html แล้วล็อกอิน PIN ให้สำเร็จก่อน',false);return}
      const {data:role,error:roleError}=await supa.from('staff_roles').select('role').eq('user_id',user.id).maybeSingle();
      if(roleError||role?.role!=='owner'){putStatus('ไม่มีสิทธิ์ใช้งาน','ต้องเป็นบัญชี owner ที่ผ่านการเข้าสู่ระบบแล้ว',false);return}
      state.ready=true;
      // Do NOT auto-enable on load, prevents accidental printing on random PCs.
      state.enabled=false;
      await check(true);
      timer=setInterval(()=>check(false),3000);
      $('enable').onclick=()=>{state.enabled=!state.enabled;render();check(false)};
      $('test').onclick=()=>printHtml(escapeTicket({id:'TEST',number:'TEST',table_code:'ทดสอบ',created_at:new Date().toISOString(),items:[{qty:1,name:'ทดสอบภาษาไทย - ลาบหมู',options:{spice:'เผ็ดกลาง'}}]})).then(()=>putStatus('ส่งคำสั่งทดสอบแล้ว','ดูผลที่เครื่องพิมพ์จริง',state.enabled)).catch(e=>putStatus('ทดสอบไม่สำเร็จ',String(e.message),false));
      $('scan').onclick=()=>check(false);
    }catch(e){putStatus('เริ่มระบบไม่ได้',String(e.message||e),false)}
  }
  start();
})();
