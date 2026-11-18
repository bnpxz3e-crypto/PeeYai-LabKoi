const cfg=window.MORI_CONFIG||{};
const cloud=!!(cfg.supabaseUrl&&cfg.supabaseAnonKey);
const supa=cloud?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
const KEY='mori_pos_demo_v2';
const demoMenu=[
{id:1,name:'ข้าวกะเพราเนื้อสับ',category:'จานหลัก',price:89,emoji:'🍛',description:'เนื้อสับผัดกะเพรา เสิร์ฟพร้อมข้าวหอมมะลิ',active:true},
{id:2,name:'ข้าวผัดกุ้ง',category:'จานหลัก',price:119,emoji:'🍤',description:'ข้าวผัดสูตรพิเศษ พร้อมกุ้งสดตัวโต',active:true},
{id:3,name:'สปาเกตตีคาโบนารา',category:'จานหลัก',price:149,emoji:'🍝',description:'ซอสครีมเข้มข้น หอมชีส',active:true},
{id:4,name:'ไก่ทอดซอสเกาหลี',category:'ทานเล่น',price:129,emoji:'🍗',description:'ไก่ทอดกรอบ รสเผ็ดหวาน',active:true},
{id:5,name:'เฟรนช์ฟรายส์',category:'ทานเล่น',price:79,emoji:'🍟',description:'ทอดกรอบ เสิร์ฟพร้อมซอสมะเขือเทศ',active:true},
{id:6,name:'สลัดผักย่าง',category:'ทานเล่น',price:99,emoji:'🥗',description:'ผักสดและผักย่าง น้ำสลัดพิเศษ',active:true},
{id:7,name:'ชาไทยเย็น',category:'เครื่องดื่ม',price:55,emoji:'🧋',description:'ชาไทยหอมเข้มข้น หวานกำลังดี',active:true},
{id:8,name:'อเมริกาโน่เย็น',category:'เครื่องดื่ม',price:65,emoji:'☕',description:'กาแฟคั่วหอม สดชื่น',active:true},
{id:9,name:'ชีสเค้กสตรอว์เบอร์รี',category:'ของหวาน',price:119,emoji:'🍰',description:'เนื้อนุ่ม ท็อปด้วยสตรอว์เบอร์รี',active:true}
];
const demoTables=['A-01','A-02','A-03','A-04','A-05','A-06','B-01','B-02','B-03','B-04','A-12','C-02'];
const demoSeed=()=>({menu:demoMenu,tables:demoTables,orders:[],nextMenuId:10,nextOrderId:1025});
function readDemo(){try{return JSON.parse(localStorage.getItem(KEY))||demoSeed()}catch{return demoSeed()}}
function writeDemo(d){localStorage.setItem(KEY,JSON.stringify(d));window.dispatchEvent(new Event('mori-demo-updated'))}
if(!cloud&&!localStorage.getItem(KEY))writeDemo(demoSeed());
const bc=(!cloud&&'BroadcastChannel'in window)?new BroadcastChannel('mori_sync'):null;
const inform=()=>{if(bc)bc.postMessage('changed')};
const imageSrc=m=>{const u=String(m?.image_url||'');return (/^https:\/\//i.test(u)||/^data:image\/(jpeg|png|webp);base64,/i.test(u))?u:''};
const foodArt=(m,cl='food-art')=>imageSrc(m)?`<div class="${cl}"><img src="${esc(imageSrc(m))}" loading="lazy" alt="${esc(m.name)}"></div>`:`<div class="${cl} emoji-art">${esc(m.emoji||'🍽️')}</div>`;
const money=n=>'฿'+Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:0,maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token=()=>crypto.randomUUID();
const timeStr=t=>new Date(t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
const statusLabel={waiting:'รอครัว',cooking:'กำลังทำ',ready:'พร้อมเสิร์ฟ',served:'เสิร์ฟแล้ว',cancelled:'ยกเลิก'};
const statusNext={waiting:'cooking',cooking:'ready',ready:'served'};
const statusAction={waiting:'เริ่มทำ',cooking:'พร้อมเสิร์ฟ',ready:'เสิร์ฟแล้ว'};
function toast(message){let e=document.getElementById('toast');if(!e)return;e.textContent=message;e.classList.add('visible');clearTimeout(window.__moriToast);window.__moriToast=setTimeout(()=>e.classList.remove('visible'),2800)}
function modal(html){const b=document.createElement('div');b.className='modal-backdrop';b.innerHTML='<div class="modal">'+html+'</div>';b.addEventListener('click',e=>{if(e.target===b)b.remove()});document.body.appendChild(b);return b}
const closeModal=()=>document.querySelector('.modal-backdrop')?.remove();
function listenDemo(callback){window.addEventListener('storage',e=>{if(e.key===KEY)callback()});window.addEventListener('mori-demo-updated',callback);if(bc)bc.onmessage=callback}
const api={
 async menus(all=false){if(!cloud)return readDemo().menu.filter(x=>all||x.active);let q=supa.from('menu_items').select('*').order('id');if(!all)q=q.eq('active',true);const {data,error}=await q;if(error)throw error;return data.map(m=>({...m,description:m.description||''}))},
 async tables(){if(!cloud)return readDemo().tables;const {data,error}=await supa.from('restaurant_tables').select('code').eq('active',true).order('code');if(error)throw error;return data.map(x=>x.code)},
 async tableAdd(code){
  code=String(code||'').trim().replace(/\s+/g,' ').toUpperCase();
  if(!code || code.length>32 || /[<>\\"'`]/.test(code))throw Error('ชื่อโต๊ะต้องมี 1-32 ตัวอักษร และไม่มีเครื่องหมายพิเศษ');
  if(!cloud){const d=readDemo();if(d.tables.includes(code))throw Error('มีโต๊ะนี้แล้ว');d.tables.push(code);d.tables.sort();writeDemo(d);inform();return}
  const {data:existing,error:checkError}=await supa.from('restaurant_tables').select('code,active').eq('code',code).maybeSingle();
  if(checkError)throw checkError;
  const result=existing?await supa.from('restaurant_tables').update({active:true}).eq('code',code):await supa.from('restaurant_tables').insert({code,active:true});
  if(result.error)throw result.error;
 },
 async tableRemove(code){
  if(!cloud){const d=readDemo();d.tables=d.tables.filter(t=>t!==code);writeDemo(d);inform();return}
  // Soft delete: preserve historical orders and their foreign-key references.
  const {error}=await supa.from('restaurant_tables').update({active:false}).eq('code',code);
  if(error)throw error;
 },
 async place(table,items){if(!cloud){let d=readDemo();if(!d.tables.includes(table))throw Error('ไม่พบโต๊ะนี้');let lines=items.map(i=>{let m=d.menu.find(x=>x.id===i.id&&x.active);if(!m||i.qty<1||i.qty>99)throw Error('รายการอาหารไม่ถูกต้อง');return {menu_id:m.id,name:m.name,price:Number(m.price),qty:i.qty,emoji:m.emoji}});let order={id:token(),number:'A-'+d.nextOrderId++,table_code:table,token:token(),items:lines,total:lines.reduce((s,x)=>s+x.price*x.qty,0),status:'waiting',payment_status:'unpaid',created_at:new Date().toISOString()};d.orders.unshift(order);writeDemo(d);inform();return {order_id:order.id,track_token:order.token,number:order.number}}const {data,error}=await supa.rpc('place_order',{p_table:table,p_items:items.map(i=>({id:i.id,qty:i.qty}))});if(error)throw error;return data},
 async tracking(t){if(!cloud){const o=readDemo().orders.find(x=>x.token===t);return o||null}const {data,error}=await supa.rpc('track_order',{p_token:t});if(error)throw error;return data},
 async orders(){if(!cloud)return readDemo().orders;const {data,error}=await supa.from('orders').select('*,order_items(*)').order('created_at',{ascending:false}).limit(500);if(error)throw error;return data.map(o=>({...o,items:(o.order_items||[]).map(i=>({menu_id:i.menu_id,name:i.name,price:Number(i.price),qty:i.qty,emoji:i.emoji}))}))},
 async menuSave(item){if(!cloud){let d=readDemo();if(item.id){let ix=d.menu.findIndex(x=>x.id===Number(item.id));if(ix<0)throw Error('ไม่พบเมนู');d.menu[ix]={...d.menu[ix],...item,id:Number(item.id)}}else d.menu.push({...item,id:d.nextMenuId++});writeDemo(d);inform();return}let obj={name:item.name,price:item.price,category:item.category,emoji:item.emoji,description:item.description,active:item.active,image_url:item.image_url||null};const {error}=item.id?await supa.from('menu_items').update(obj).eq('id',item.id):await supa.from('menu_items').insert(obj);if(error)throw error},
 async uploadMenuImage(file){
   if(!file)throw Error('กรุณาเลือกรูปภาพ');
   if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('รองรับเฉพาะ JPG, PNG หรือ WebP');
   if(file.size>3*1024*1024)throw Error('รูปภาพต้องไม่เกิน 3 MB');
   if(!cloud){
     return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('อ่านรูปไม่สำเร็จ'));reader.readAsDataURL(file)})
   }
   const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
   const path=`menu/${crypto.randomUUID()}.${ext}`;
   const {error}=await supa.storage.from('menu-images').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
   if(error)throw error;
   return supa.storage.from('menu-images').getPublicUrl(path).data.publicUrl;
 },
 async menuDelete(id){if(!cloud){let d=readDemo();d.menu=d.menu.filter(x=>x.id!==id);writeDemo(d);inform();return}const {error}=await supa.from('menu_items').delete().eq('id',id);if(error)throw error},
 async orderStatus(id,status){if(!cloud){let d=readDemo();let o=d.orders.find(x=>x.id===id);if(!o)throw Error('ไม่พบออเดอร์');o.status=status;writeDemo(d);inform();return}const {error}=await supa.from('orders').update({status}).eq('id',id);if(error)throw error},
 async payment(id,paid){if(!cloud){let d=readDemo();let o=d.orders.find(x=>x.id===id);if(!o)throw Error('ไม่พบออเดอร์');o.payment_status=paid?'paid':'unpaid';writeDemo(d);inform();return}const {error}=await supa.from('orders').update({payment_status:paid?'paid':'unpaid'}).eq('id',id);if(error)throw error},
 async editOrder(id,lines){if(!cloud){let d=readDemo();let o=d.orders.find(x=>x.id===id);if(!o)throw Error('ไม่พบออเดอร์');o.items=lines.map(i=>{let m=d.menu.find(x=>x.id===i.id);if(!m)throw Error('ไม่พบเมนู');return {menu_id:m.id,name:m.name,price:Number(m.price),qty:i.qty,emoji:m.emoji}});o.total=o.items.reduce((a,x)=>a+x.qty*x.price,0);writeDemo(d);inform();return}const {error}=await supa.rpc('owner_edit_order',{p_order_id:id,p_items:lines.map(i=>({id:i.id,qty:i.qty}))});if(error)throw error},
 async authenticate(email,password){if(!cloud)return true;const {error}=await supa.auth.signInWithPassword({email,password});if(error)throw error;const {data,error:e}=await supa.from('staff_roles').select('role').eq('user_id',(await supa.auth.getUser()).data.user.id).maybeSingle();if(e||data?.role!=='owner'){await supa.auth.signOut();throw Error('บัญชีนี้ไม่มีสิทธิ์เจ้าของร้าน')}return true},
 async isOwner(){if(!cloud)return sessionStorage.getItem('mori-demo-owner')==='yes';const {data:{user}}=await supa.auth.getUser();if(!user)return false;const {data}=await supa.from('staff_roles').select('role').eq('user_id',user.id).maybeSingle();return data?.role==='owner'},
 async logout(){if(!cloud)sessionStorage.removeItem('mori-demo-owner');else await supa.auth.signOut()},
 subscribe(callback){if(!cloud){listenDemo(callback);return}const ch=supa.channel('mori-owner').on('postgres_changes',{event:'*',schema:'public',table:'orders'},callback).on('postgres_changes',{event:'*',schema:'public',table:'order_items'},callback).on('postgres_changes',{event:'*',schema:'public',table:'menu_items'},callback).on('postgres_changes',{event:'*',schema:'public',table:'restaurant_tables'},callback).subscribe();return ()=>supa.removeChannel(ch)}
};
